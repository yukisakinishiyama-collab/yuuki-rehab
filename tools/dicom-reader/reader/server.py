"""院のパソコンで動く小さな常駐プログラム（127.0.0.1 だけで待つ）。

院内アプリのカルテ（ブラウザ）から呼ばれて、CDのDICOMを読み、Claude Code に読影させ、PDFを作る。
- 呼べるのは、決めたアドレス（院内アプリ）のページだけ（Origin を確かめる）
- 氏名・患者ID・施設名・日付はAIに渡さない。PDFの見出しにだけ使う
- 同時に動かせる読影は1件。下書き（PDF・画像の配列）はこのパソコンに置き、カルテに保存したら消す
"""
from __future__ import annotations

import datetime as dt
import json
import os
import re
import secrets
import shutil
import sys
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from . import agent, dicomio, render, reportschema

VERSION = "1.0.0"
HERE = Path(__file__).resolve().parent
DEFAULT_ORIGINS = ["https://yuuki-rehab.vercel.app", "https://shimonoseki-yuuki.com", "https://www.shimonoseki-yuuki.com",
                   "http://localhost:3000", "http://127.0.0.1:3000"]
DEFAULTS = {"port": 8791, "origins": DEFAULT_ORIGINS, "folders": [], "model": None, "effort": None, "claude_cmd": None,
            "browser": None, "max_pdf_bytes": 3_800_000, "keep_days": 7, "timeout_min": 45}
ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
SEX_JA = {"F": "女性", "M": "男性", "female": "女性", "male": "男性"}


def data_dir() -> Path:
    if os.environ.get("YDR_DATA"):
        return Path(os.environ["YDR_DATA"])
    base = os.environ.get("LOCALAPPDATA") or str(Path.home() / ".local" / "share")
    return Path(base) / "yuuki-dicom-reader"


def load_config() -> dict:
    cfg = dict(DEFAULTS)
    f = data_dir() / "config.json"
    if f.exists():
        try:
            cfg.update({k: v for k, v in json.loads(f.read_text(encoding="utf-8-sig")).items() if k in DEFAULTS})
        except Exception:  # noqa: BLE001
            pass
    return cfg


class Jobs:
    def __init__(self):
        self.dir = data_dir() / "jobs"
        self.dir.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()
        self.running: str | None = None
        self.procs: dict[str, dict] = {}
        self.cancelled: set[str] = set()
        # 前回の起動中に止まったままの読影は「中断」にする
        for j in self.all():
            if j["status"] in ("queued", "running"):
                j.update(status="error", error="読影の途中でプログラムが止まりました。もう一度お試しください。")
                self.save(j)
        self.purge(load_config()["keep_days"])

    def path(self, jid: str) -> Path:
        if not ID_RE.match(jid):
            raise KeyError(jid)
        return self.dir / jid

    def load(self, jid: str) -> dict:
        f = self.path(jid) / "job.json"
        if not f.exists():
            raise KeyError(jid)
        return json.loads(f.read_text(encoding="utf-8"))

    def save(self, job: dict) -> None:
        d = self.path(job["id"])
        d.mkdir(parents=True, exist_ok=True)
        tmp = d / "job.json.tmp"
        tmp.write_text(json.dumps(job, ensure_ascii=False, indent=1), encoding="utf-8")
        tmp.replace(d / "job.json")

    def all(self) -> list[dict]:
        out = []
        for d in self.dir.iterdir() if self.dir.exists() else []:
            try:
                out.append(json.loads((d / "job.json").read_text(encoding="utf-8")))
            except Exception:  # noqa: BLE001
                continue
        return sorted(out, key=lambda j: j.get("created", ""), reverse=True)

    def purge(self, keep_days: int) -> None:
        limit = (dt.datetime.now() - dt.timedelta(days=keep_days)).isoformat()
        for j in self.all():
            if j.get("created", "") < limit and j["status"] not in ("queued", "running"):
                shutil.rmtree(self.path(j["id"]), ignore_errors=True)

    def remove(self, jid: str) -> None:
        self.cancel(jid)
        shutil.rmtree(self.path(jid), ignore_errors=True)

    def cancel(self, jid: str) -> None:
        self.cancelled.add(jid)
        p = self.procs.get(jid, {}).get("proc")
        if p:
            agent.kill_tree(p)

    def log(self, job: dict, text: str) -> None:
        job.setdefault("log", []).append(f"{time.strftime('%H:%M')} {text}")
        job["log"] = job["log"][-60:]
        job["stage"] = text
        self.save(job)

    # ── 読影の本体 ──
    def start(self, req: dict) -> dict:
        with self.lock:
            if self.running:
                raise RuntimeError("ほかの読影が動いています。終わってからもう一度お試しください。")
            jid = dt.datetime.now().strftime("%Y%m%d-%H%M%S-") + secrets.token_hex(3)
            job = {"id": jid, "status": "queued", "stage": "準備しています", "created": dt.datetime.now().isoformat(timespec="seconds"),
                   "patient": req["patient"], "complaint": req["complaint"], "question": req["question"], "path": req["path"],
                   "studies": req["studies"], "log": []}
            self.save(job)
            self.running = jid
        threading.Thread(target=self._run, args=(jid,), daemon=True).start()
        return job

    def _run(self, jid: str) -> None:
        job = self.load(jid)
        cfg = load_config()
        work = self.path(jid) / "work"
        t0 = time.time()
        try:
            job["status"] = "running"
            self.log(job, "CDの画像を読み込んでいます")
            work.mkdir(parents=True, exist_ok=True)
            got = dicomio.ingest(job["path"], job["studies"] or None, work, progress=lambda m: self.log(job, m))
            hd = got["header"]
            pat = job["patient"]
            birth = hd.get("birth_date") or pat.get("birthDate") or ""
            age_text = dicomio._age_text(birth, hd.get("study_date") or dt.date.today().isoformat())
            sex_ja = SEX_JA.get(hd.get("sex") or "", "") or SEX_JA.get(pat.get("gender") or "", "")
            idents = sorted(set(got["identifiers"]) | {x for x in re.split(r"[\s　]+", pat.get("name") or "") if len(x) >= 2}
                            | ({pat["name"].replace(" ", "").replace("　", "")} if pat.get("name") else set()), key=len, reverse=True)
            dicomio.write_case(work, got["series"], age_text, sex_ja, dicomio.scrub(job["complaint"], idents),
                               dicomio.scrub(job["question"], idents))
            for src, dst in (("workspace/rt.py", "rt.py"), ("workspace/INSTRUCTIONS.md", "INSTRUCTIONS.md"),
                             ("imaging.py", "rtlib.py"), ("reportschema.py", "rtcheck.py")):
                shutil.copyfile(HERE / src, work / dst)
            job["series"] = got["series"]
            job["header"] = {"name": pat.get("name") or hd.get("dicom_name") or "", "patient_id": hd.get("patient_id") or "",
                             "age_text": age_text, "sex_ja": sex_ja, "study_date": hd.get("study_date") or "",
                             "times": hd.get("times") or {}, "institution": hd.get("institution") or "",
                             "weight_kg": hd.get("weight_kg") or "", "equipment": hd.get("equipment") or {},
                             "counts": hd.get("counts") or {}, "complaint": job["complaint"],
                             "created": dt.date.today().isoformat(), "author": "Claude（AI）"}
            if jid in self.cancelled:
                raise InterruptedError
            claude = agent.find_claude(cfg.get("claude_cmd"))
            if not claude:
                raise RuntimeError("このパソコンに Claude Code が見つかりません。")
            self.log(job, "AIが読影を始めました（10〜25分ほどかかります）")
            holder = self.procs.setdefault(jid, {})
            acfg = {"model": cfg.get("model"), "effort": cfg.get("effort"), "python_dir": str(Path(sys.executable).parent)}

            def on_stage(text, counts):
                if job.get("stage") != text:
                    self.log(job, text)

            res = agent.run(claude, work, acfg, agent.PROMPT, on_stage, holder, timeout=int(cfg["timeout_min"]) * 60)
            job["usage"] = [{k: res.get(k) for k in ("turns", "cost_usd", "seconds", "tokens", "images_read")}]
            if jid in self.cancelled:
                raise InterruptedError
            report, problems = reportschema.check_file(work)
            if res["kind"] in ("limit", "login") and (not report or problems):
                raise RuntimeError(res["message"])
            if problems and res["kind"] != "timeout":
                self.log(job, "レポートの形を整えています")
                res2 = agent.run(claude, work, acfg, agent.REPAIR_PROMPT, on_stage, holder, timeout=600)
                job["usage"].append({k: res2.get(k) for k in ("turns", "cost_usd", "seconds", "tokens", "images_read")})
                report, problems = reportschema.check_file(work)
            if not report.get("summary") or not report.get("sections"):
                detail = res["message"] if not res["ok"] else " / ".join(problems[:3])
                raise RuntimeError(f"レポートを作れませんでした：{detail}"[:400])
            job["warnings"] = problems[:8]
            if jid in self.cancelled:
                raise InterruptedError
            self.log(job, "PDFにまとめています")
            _, pdf = render.make_pdf(report, job["header"], got["series"], work, self.path(jid) / "out",
                                     int(cfg["max_pdf_bytes"]), cfg.get("browser"))
            sid = re.sub(r"[^0-9A-Za-z]", "", job["header"]["patient_id"])[:20]
            date = (job["header"]["study_date"] or "").replace("-", "")
            job["result"] = {
                "title_region": report["title_region"], "headline": report["headline"], "summary": report["summary"],
                "estimates": report["estimates"], "modalities": list(job["header"]["counts"].keys()),
                "counts": job["header"]["counts"], "study_date": job["header"]["study_date"], "institution": job["header"]["institution"],
                "bytes": pdf.stat().st_size, "file_name": f"画像所見レポート_{sid or 'ID'}_{date or 'date'}.pdf",
                "minutes": round((time.time() - t0) / 60, 1),
            }
            job["status"] = "done"
            self.log(job, f"できました（{job['result']['minutes']}分）。内容を確かめて、カルテに保存してください")
            # 画素の配列は大きいので、できあがったら消す（図と文は残す）
            shutil.rmtree(work / "series", ignore_errors=True)
            shutil.rmtree(work / "views", ignore_errors=True)
        except InterruptedError:
            job.update(status="cancelled", error="中止しました")
            self.log(job, "中止しました")
            shutil.rmtree(work, ignore_errors=True)
        except Exception as e:  # noqa: BLE001
            job.update(status="error", error=str(e)[:500] or type(e).__name__)
            (self.path(jid) / "error.txt").write_text(traceback.format_exc(), encoding="utf-8")
            self.log(job, f"エラー：{job['error']}")
            shutil.rmtree(work / "series", ignore_errors=True)
        finally:
            self.procs.pop(jid, None)
            with self.lock:
                if self.running == jid:
                    self.running = None


def public_job(j: dict, detail: bool = False) -> dict:
    out = {"id": j["id"], "status": j["status"], "stage": j.get("stage"), "created": j.get("created"),
           "patientId": (j.get("patient") or {}).get("id"), "complaint": j.get("complaint") or "", "error": j.get("error"),
           "result": j.get("result")}
    if detail:
        out.update(log=j.get("log") or [], warnings=j.get("warnings") or [], usage=j.get("usage") or [])
    return out


class Handler(BaseHTTPRequestHandler):
    server_version = "YuukiDicomReader/" + VERSION
    jobs: Jobs
    _login_cache: dict = {}

    def log_message(self, fmt, *args):  # 氏名などを記録に残さない
        return

    # ── 共通 ──
    def _origin_ok(self) -> tuple[bool, str | None]:
        cfg = load_config()
        host = (self.headers.get("Host") or "").lower()
        if host not in (f"127.0.0.1:{cfg['port']}", f"localhost:{cfg['port']}"):
            return False, None
        origin = self.headers.get("Origin")
        if origin:
            return origin in cfg["origins"], origin
        # Origin が無い要求は、ブラウザ以外（このパソコンの中の確認用）だけ
        return self.headers.get("Sec-Fetch-Site") is None, None

    def _send(self, code: int, body, ctype: str = "application/json; charset=utf-8", origin: str | None = None, extra: dict | None = None):
        data = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def _body(self) -> dict:
        n = int(self.headers.get("Content-Length") or 0)
        if n > 200_000:
            raise ValueError("要求が大きすぎます")
        return json.loads(self.rfile.read(n).decode("utf-8") or "{}") if n else {}

    def do_OPTIONS(self):
        ok, origin = self._origin_ok()
        if not ok or not origin:
            return self._send(403, {"error": "このページからは使えません"})
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Max-Age", "600")
        self.end_headers()

    def _route(self, method: str):
        ok, origin = self._origin_ok()
        if not ok:
            return self._send(403, {"error": "このページからは使えません"})
        url = urlparse(self.path)
        parts = [p for p in url.path.split("/") if p]
        q = parse_qs(url.query)
        try:
            if method == "GET" and parts == ["health"]:
                return self._send(200, self._health(), origin=origin)
            if method == "GET" and parts == ["sources"]:
                return self._send(200, {"sources": dicomio.list_sources(load_config()["folders"])}, origin=origin)
            if method == "POST" and parts == ["scan"]:
                path = self._allowed_path(str(self._body().get("path") or ""))
                return self._send(200, dicomio.scan(path), origin=origin)
            if method == "POST" and parts == ["jobs"]:
                return self._send(200, public_job(self.jobs.start(self._job_request(self._body()))), origin=origin)
            if method == "GET" and parts == ["jobs"]:
                pid = (q.get("patientId") or [""])[0]
                jobs = [public_job(j) for j in self.jobs.all() if not pid or (j.get("patient") or {}).get("id") == pid]
                return self._send(200, {"jobs": jobs[:20], "running": self.jobs.running}, origin=origin)
            if len(parts) >= 2 and parts[0] == "jobs":
                jid = parts[1]
                if method == "GET" and len(parts) == 2:
                    return self._send(200, public_job(self.jobs.load(jid), detail=True), origin=origin)
                if method == "GET" and parts[2:] == ["pdf"]:
                    f = self.jobs.path(jid) / "out" / "report.pdf"
                    if not f.is_file():
                        raise KeyError(jid)
                    return self._send(200, f.read_bytes(), "application/pdf", origin)
                if method == "POST" and parts[2:] == ["cancel"]:
                    self.jobs.cancel(jid)
                    return self._send(200, {"ok": True}, origin=origin)
                if method == "DELETE" and len(parts) == 2:
                    self.jobs.load(jid)
                    self.jobs.remove(jid)
                    return self._send(200, {"ok": True}, origin=origin)
            return self._send(404, {"error": "見つかりません"}, origin=origin)
        except KeyError:
            return self._send(404, {"error": "見つかりません"}, origin=origin)
        except (ValueError, RuntimeError) as e:
            return self._send(400 if isinstance(e, ValueError) else 409, {"error": str(e)}, origin=origin)
        except Exception as e:  # noqa: BLE001
            return self._send(500, {"error": f"{type(e).__name__}: {e}"[:300]}, origin=origin)

    def do_GET(self):
        self._route("GET")

    def do_POST(self):
        self._route("POST")

    def do_DELETE(self):
        self._route("DELETE")

    # ── 中身 ──
    def _health(self) -> dict:
        cfg = load_config()
        claude = agent.find_claude(cfg.get("claude_cmd"))
        c = Handler._login_cache
        if claude and (not c or time.time() - c.get("at", 0) > 90):
            c.clear()
            c.update(agent.login_status(claude), at=time.time())
        return {"ok": True, "version": VERSION, "claude": bool(claude), "loggedIn": c.get("logged_in") if claude else None,
                "pdf": bool(render.find_browser(cfg.get("browser"))), "running": self.jobs.running}

    def _allowed_path(self, path: str) -> str:
        """読めるのは、CD・USB と、設定で決めたフォルダの中だけ"""
        if not path:
            raise ValueError("読み込む場所がありません")
        p = Path(path).resolve()
        roots = [Path(s["path"]).resolve() for s in dicomio.list_sources(load_config()["folders"])]
        if not any(p == r or r in p.parents for r in roots):
            raise ValueError("この場所は読み込めません（CD・USB か、設定したフォルダだけ）")
        return str(p)

    def _job_request(self, b: dict) -> dict:
        pat = b.get("patient") or {}
        if not ID_RE.match(str(pat.get("id") or "")):
            raise ValueError("患者さんの情報が足りません")
        if b.get("confirmedNoText") is not True:
            raise ValueError("画像に氏名などの文字が写っていないことの確認が要ります")
        studies = [str(s) for s in (b.get("studies") or [])][:20]
        return {"path": self._allowed_path(str(b.get("path") or "")), "studies": studies,
                "patient": {"id": str(pat["id"]), "name": str(pat.get("name") or "")[:60], "birthDate": str(pat.get("birthDate") or "")[:10],
                            "gender": str(pat.get("gender") or "")[:10]},
                "complaint": str(b.get("complaint") or "")[:600], "question": str(b.get("question") or "")[:600]}


def main() -> None:
    cfg = load_config()
    data_dir().mkdir(parents=True, exist_ok=True)
    Handler.jobs = Jobs()
    srv = ThreadingHTTPServer(("127.0.0.1", int(cfg["port"])), Handler)
    srv.daemon_threads = True
    print(f"yuuki-dicom-reader {VERSION} http://127.0.0.1:{cfg['port']}  data={data_dir()}", flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
