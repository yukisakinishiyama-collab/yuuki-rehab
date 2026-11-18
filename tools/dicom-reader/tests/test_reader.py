"""読影プログラムの通しテスト（架空の画像・Claude Code の代わりを使う。外には送らない）。

実行: python -m pytest tools/dicom-reader/tests -q
"""
from __future__ import annotations

import json
import os
import sys
import threading
import time
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

ORIGIN = "https://yuuki-rehab.vercel.app"


@pytest.fixture()
def env(tmp_path, monkeypatch):
    import make_dicom
    from reader import server
    cd = make_dicom.make(tmp_path / "cd" / "DICOM" / "PA1")
    data = tmp_path / "data"
    data.mkdir()
    monkeypatch.setenv("YDR_DATA", str(data))
    monkeypatch.delenv("FAKE_CLAUDE", raising=False)
    srv = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
    port = srv.server_address[1]
    (data / "config.json").write_text(json.dumps({
        "port": port, "folders": [str(tmp_path / "cd")], "claude_cmd": [sys.executable, str(Path(__file__).parent / "fake_claude.py")],
        "timeout_min": 1}), encoding="utf-8")
    server.Handler.jobs = server.Jobs()
    server.Handler._login_cache = {}
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    def call(method, path, body=None, origin=ORIGIN, headers=None, raw=False):
        req = urllib.request.Request(f"http://127.0.0.1:{port}{path}", method=method,
                                     data=json.dumps(body).encode() if body is not None else None)
        req.add_header("Content-Type", "application/json")
        if origin:
            req.add_header("Origin", origin)
        for k, v in (headers or {}).items():
            req.add_header(k, v)
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data_ = r.read()
                return r.status, (data_ if raw else json.loads(data_ or b'{}')), dict(r.headers)
        except urllib.error.HTTPError as e:
            b = e.read()
            return e.code, (json.loads(b) if b else {}), dict(e.headers)

    yield {"call": call, "cd": tmp_path / "cd", "data": data, "port": port, "server": server}
    srv.shutdown()


def wait(call, jid, until=("done", "error", "cancelled"), timeout=90):
    t0 = time.time()
    while time.time() - t0 < timeout:
        _, j, _ = call("GET", f"/jobs/{jid}")
        if j["status"] in until:
            return j
        time.sleep(0.3)
    raise AssertionError(f"job did not finish: {j}")


PATIENT = {"id": "pt_abc123", "name": "試験 花子", "birthDate": "2017-11-15", "gender": "female"}


def start(env, **over):
    body = {"path": str(env["cd"]), "studies": [], "patient": PATIENT, "complaint": "試験花子さん 右足関節の前方の痛み。踏み込みで痛い。",
            "question": "骨折はありますか", "confirmedNoText": True}
    body.update(over)
    return env["call"]("POST", "/jobs", body)


def test_only_the_clinic_app_may_call(env):
    call = env["call"]
    assert call("GET", "/health")[0] == 200
    assert call("GET", "/health", origin="https://evil.example")[0] == 403
    assert call("GET", "/health", origin="https://yuuki-rehab-evil.vercel.app")[0] == 403
    # ブラウザからの Origin なしの要求（画像・iframe の埋め込み）は通さない。このパソコンの中の確認用だけ通す
    assert call("GET", "/jobs", origin=None, headers={"Sec-Fetch-Site": "cross-site"})[0] == 403
    assert call("GET", "/jobs", origin=None)[0] == 200
    assert call("GET", "/health", headers={"Host": "attacker.example"})[0] == 403          # DNS のすり替え対策
    st, _, h = call("OPTIONS", "/jobs", headers={"Access-Control-Request-Method": "POST", "Access-Control-Request-Private-Network": "true"})
    assert st == 204 and h["Access-Control-Allow-Origin"] == ORIGIN and h["Access-Control-Allow-Private-Network"] == "true"
    assert call("OPTIONS", "/jobs", origin="https://evil.example")[0] == 403
    assert call("POST", "/scan", {"path": str(env["data"])})[0] == 400                      # 決めた場所の外は読まない
    assert call("POST", "/scan", {"path": str(env["cd"] / ".." / "data")})[0] == 400


def test_scan_shows_who_is_on_the_cd(env):
    st, s, _ = env["call"]("POST", "/scan", {"path": str(env["cd"])})
    assert st == 200 and s["patient"] == {"name": "試験 花子", "id": "0099887766", "birth_date": "2017-11-15", "sex": "F"}
    assert s["n_files"] == 18 and not s["several_patients"] and len(s["studies"]) == 2
    mr = next(x for x in s["studies"] if "MR" in x["modalities"])
    assert mr["date"] == "2026-10-27" and mr["n_images"] == 16 and len(mr["series"]) == 2 and mr["modalities_ja"] == ["MRI"]
    assert all(x["thumbs"] and x["thumbs"][0].startswith("data:image/jpeg;base64,") for x in mr["series"])
    cr = next(x for x in s["studies"] if "CR" in x["modalities"])
    assert len(cr["series"][0]["thumbs"]) == 2                                              # X線は全部を見本に出す
    assert env["call"]("GET", "/sources")[1]["sources"][-1]["kind"] == "folder"


def test_reading_makes_a_pdf_without_giving_names_to_the_ai(env):
    call = env["call"]
    assert start(env, confirmedNoText=False)[0] == 400
    assert start(env, patient={"id": "../x"})[0] == 400
    st, j, _ = start(env)
    assert st == 200 and j["status"] in ("queued", "running")
    assert start(env)[0] == 409                                                             # 同時に1件だけ
    j = wait(call, j["id"])
    assert j["status"] == "done", j
    r = j["result"]
    assert r["title_region"] == "右足関節" and r["headline"].startswith("骨折") and r["study_date"] == "2026-10-27"
    assert r["counts"] == {"MRI": 16, "単純X線": 2} and r["file_name"] == "画像所見レポート_0099887766_20261027.pdf"
    assert r["estimates"][0] == {"condition": "前方の関節包の刺激", "percent": 60, "basis": "圧痛と一致"}
    assert any("全スライス" in x for x in j["log"]) and any("図を作って" in x for x in j["log"]) and j["usage"][0]["images_read"] == 1
    st, pdf, h = call("GET", f"/jobs/{j['id']}/pdf", raw=True)
    assert st == 200 and pdf[:5] == b"%PDF-" and h["Content-Type"] == "application/pdf" and len(pdf) == r["bytes"] < 3_800_000
    jd = env["data"] / "jobs" / j["id"]
    html = (jd / "out" / "report.html").read_text(encoding="utf-8")
    # 見出し（氏名・患者ID・施設・装置・年齢）と免責はプログラムが入れる
    for word in ("試験 花子 様", "0099887766", "架空病院", "8歳11か月・女性", "Canon Gracian 1.5T", "KONICA MINOLTA CS-7", "27 kg",
                 "単純X線 2枚・MRI 16枚", "2026-10-27（単純X線 09:29／MRI 10:31）", "右足関節 単純X線・MRI", "確定診断ではありません", "主観的な見積もり",
                 "5891 / 81 / 140", "3 / 3.6 mm", "<b>骨折・骨端線損傷を示す所見はありません。</b>", "約60%"):
        assert word in html, word
    assert "<script>" not in html and "&lt;script&gt;" in html                              # AIの文はHTMLとして解釈しない
    assert html.count("data:image/jpeg;base64,") == 2
    # AIの作業フォルダには氏名・ID・施設が無い（fake_claude.py も中で確かめている）
    work = jd / "work"
    for f in list(work.glob("*.md")) + list(work.glob("out/*.json")) + list(work.glob("out/*.log")):
        t = f.read_text(encoding="utf-8")
        assert "試験" not in t and "0099887766" not in t and "架空病院" not in t, f
    assert "■" in (work / "case.md").read_text(encoding="utf-8")                           # 主訴に書かれたお名前も消す
    assert not (work / "series").exists()                                                   # 大きな配列は残さない
    lst = call("GET", "/jobs?patientId=pt_abc123")[1]
    assert [x["id"] for x in lst["jobs"]] == [j["id"]] and lst["running"] is None
    assert call("GET", "/jobs?patientId=other")[1]["jobs"] == []
    assert call("DELETE", f"/jobs/{j['id']}")[0] == 200 and not jd.exists()
    assert call("GET", f"/jobs/{j['id']}/pdf")[0] == 404


def test_report_is_repaired_or_the_reason_is_said(env, monkeypatch):
    call = env["call"]
    monkeypatch.setenv("FAKE_CLAUDE", "needs_repair")
    j = wait(call, start(env)[1]["id"])
    assert j["status"] == "done" and j["result"]["headline"] and len(j["usage"]) == 2 and any("形を整えて" in x for x in j["log"])
    monkeypatch.setenv("FAKE_CLAUDE", "limit")
    j = wait(call, start(env)[1]["id"])
    assert j["status"] == "error" and "使用枠" in j["error"] and "4:40pm" in j["error"]
    monkeypatch.setenv("FAKE_CLAUDE", "loggedout")
    env["server"].Handler._login_cache = {}
    h = call("GET", "/health")[1]
    assert h == {"ok": True, "version": env["server"].VERSION, "claude": True, "loggedIn": False, "pdf": True, "running": None}


def test_cancel_stops_the_reading(env, monkeypatch):
    call = env["call"]
    monkeypatch.setenv("FAKE_CLAUDE", "slow")
    jid = start(env)[1]["id"]
    t0 = time.time()
    while "レポートを点検" not in (call("GET", f"/jobs/{jid}")[1].get("stage") or "") and time.time() - t0 < 60:
        time.sleep(0.2)
    assert call("POST", f"/jobs/{jid}/cancel")[0] == 200
    j = wait(call, jid, timeout=20)
    assert j["status"] == "cancelled" and call("GET", "/health")[1]["running"] is None


def test_report_shape_is_checked(tmp_path):
    from reader import reportschema
    (tmp_path / "figures").mkdir()
    (tmp_path / "figures" / "fig1.jpg").write_bytes(b"x")
    good = {"title_region": "右膝", "headline": "h", "summary": ["s"], "sections": [{"heading": "1", "blocks": [
        {"type": "figure", "file": "figures/fig1.jpg", "caption": "c"}, {"type": "p", "text": "t"}]}],
        "estimates": [{"condition": "a", "percent": 70, "basis": "b"}]}
    out, problems = reportschema.validate(good, tmp_path)
    assert problems == [] and out["sections"][0]["blocks"][0] == {"type": "series_table"}    # 撮像の表は必ず入れる
    assert out["sections"][-1]["blocks"] == [{"type": "estimates"}]                           # 見積もりの表も
    bad = {"title_region": "", "summary": [], "sections": [{"heading": "1", "blocks": [
        {"type": "figure", "file": "../secret.jpg", "caption": "c"}, {"type": "figure", "file": "figures/none.jpg", "caption": "c"},
        {"type": "table", "columns": ["a", "b"], "rows": [["x"]]}, {"type": "html", "text": "<b>"}]}],
        "estimates": [{"condition": "a", "percent": 90}, {"condition": "b", "percent": 80}]}
    _, problems = reportschema.validate(bad, tmp_path)
    text = " ".join(problems)
    for word in ("title_region", "headline", "summary", "figures/◯◯.jpg", "figures/none.jpg がありません", "columns（2個）", "type は", "合計が100%"):
        assert word in text, word
    assert reportschema.check_file(tmp_path)[1] == ["out/report.json がまだありません"]
