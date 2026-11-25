"""Claude Code の代わり（テスト用）。`auth status` と `-p` だけまねる。ネットにはつながない。"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path


def emit(obj):
    print(json.dumps(obj, ensure_ascii=False), flush=True)


def tool(cmd):
    emit({"type": "assistant", "message": {"content": [{"type": "tool_use", "name": "Bash", "input": {"command": cmd}}]}})
    return subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding="utf-8")


def main():
    args = sys.argv[1:]
    if args[:2] == ["auth", "status"]:
        print(json.dumps({"loggedIn": os.environ.get("FAKE_CLAUDE") != "loggedout", "subscriptionType": "max"}))
        return 0
    assert "-p" in args and "--restricted" in args and "--strict-mcp-config" in args and "--disable-slash-commands" in args, args
    prompt = sys.stdin.read()
    mode = os.environ.get("FAKE_CLAUDE", "")
    if mode == "limit":
        emit({"type": "result", "subtype": "success", "is_error": True, "result": "You've hit your session limit · resets 4:40pm (Asia/Tokyo)",
              "num_turns": 1, "total_cost_usd": 0})
        return 1
    assert Path("INSTRUCTIONS.md").exists() and Path("case.md").exists() and Path("rt.py").exists()
    case = Path("case.md").read_text(encoding="utf-8")
    assert "試験" not in case and "HANAKO" not in case and "0099887766" not in case and "架空病院" not in case, "氏名などがAIに渡っている"
    assert not list(Path(".").rglob("*.dcm")) and not Path("job.json").exists()
    Path("out").mkdir(exist_ok=True)
    if Path("consult.md").exists():
        return consult(prompt, mode)
    if "直す所が残っています" in prompt:
        r = json.loads(Path("out/report.json").read_text(encoding="utf-8"))
        r["headline"] = "骨折を示す所見なし。前方に少量の液体"
        Path("out/report.json").write_text(json.dumps(r, ensure_ascii=False), encoding="utf-8")
        tool("python rt.py check")
        emit({"type": "result", "subtype": "success", "is_error": False, "result": "完了", "num_turns": 2, "total_cost_usd": 0.01})
        return 0
    out = tool("python rt.py list").stdout
    assert "s02_MR" in out and "番号が増えると" in out, out
    tool("python rt.py montage s02")
    emit({"type": "assistant", "message": {"content": [{"type": "tool_use", "name": "Read", "input": {"file_path": "views/s02_montage_01.png"}}]}})
    tool("python rt.py strip s02 3-6 --box 50,90,20,70")
    roi = tool("python rt.py roi s02 4 --rect 67,71,36,46 --rect 80,90,60,70").stdout
    assert "中央値" in roi, roi
    d = tool("python rt.py dist s02 4 67,36 67,46").stdout
    assert "5.0 mm" in d, d
    x = tool("python rt.py xref s02 4 69,40 s03").stdout
    assert "s03_MR" in x and "#4" in x, x
    fig = {"out": "fig1", "rows": [[
        {"series": "s02", "k": 4, "box": [30, 110, 10, 100], "label": "矢状断 STIR #4",
         "marks": [{"type": "arrow", "from": [50, 30], "to": [66, 40]}, {"type": "line", "from": [67, 36], "to": [67, 46], "label": "5 mm", "color": "cyan"},
                   {"type": "circle", "center": [86, 64], "r": 12, "dashed": True, "color": "pink"}, {"type": "rect", "box": [60, 76, 30, 52], "dashed": True},
                   {"type": "text", "at": [40, 60], "text": "液", "color": "yellow"}]},
        {"series": "s03", "k": 4, "box": [30, 110, 10, 100], "label": "矢状断 T1 #4"}],
        [{"series": "s02", "k": k, "box": [50, 90, 20, 70], "label": f"#{k}", "scalebar_mm": 5} for k in (3, 4, 5, 6)]]}
    Path("out/fig1.json").write_text(json.dumps(fig, ensure_ascii=False), encoding="utf-8")
    r = tool("python rt.py figure out/fig1.json")
    assert "figures/fig1.jpg" in r.stdout, r.stdout + r.stderr
    Path("out/fig2.json").write_text(json.dumps({"out": "fig2", "rows": [[{"series": "s01", "k": 1, "label": "右 正面"}, {"series": "s01", "k": 2, "label": "右 側面", "flip": True}]]}), encoding="utf-8")
    tool("python rt.py figure out/fig2.json")
    report = {
        "title_region": "右足関節",
        "headline": "" if mode == "needs_repair" else "骨折を示す所見なし。前方に少量の液体",
        "summary": ["**骨折・骨端線損傷を示す所見はありません。** T1で骨折線はありません。", "前方に少量の液体があります（前後 約5 mm）。<script>alert(1)</script>"],
        "sections": [
            {"heading": "1. 撮像内容と左右の確認", "blocks": [{"type": "series_table"}, {"type": "p", "text": "左右と向き：シリーズ名（Rt）で確認。"},
                                                    {"type": "note", "text": "撮像されていないもの：横断像。"}]},
            {"heading": "2. 前方の所見", "blocks": [{"type": "figure", "file": "figures/fig1.jpg", "caption": "図1 矢状断 STIR と T1。", "width": 90},
                                               {"type": "table", "columns": ["構造", "所見"], "widths": [30, 70], "rows": [["前方陥凹", "少量の液体"]]},
                                               {"type": "figure", "file": "figures/fig2.jpg", "caption": "図2 単純X線。"}]},
            {"heading": "3. 症状との関係", "blocks": [{"type": "p", "text": "圧痛部位と一致します。"}, {"type": "estimates"}]},
            {"heading": "4. 提案", "blocks": [{"type": "h3", "text": "圧痛点の特定"}, {"type": "list", "items": ["前方関節裂隙か、腱の上かを確かめる"]},
                                            {"type": "box", "title": "早めに医師の再診を勧めるサイン", "text": "夜間痛・腫れの増加。"}]},
        ],
        "estimates": [{"condition": "前方の関節包の刺激", "percent": 60, "basis": "圧痛と一致"}, {"condition": "機能的な痛み", "percent": 40, "basis": "骨に異常なし"}],
        "references": ["Schweitzer ME, et al. AJR Am J Roentgenol. 1994;162(1):111-114."],
    }
    Path("out/report.json").write_text(json.dumps(report, ensure_ascii=False), encoding="utf-8")
    emit({"type": "assistant", "message": {"content": [{"type": "tool_use", "name": "Write", "input": {"file_path": "out/report.json"}}]}})
    chk = tool("python rt.py check")
    assert ("OK" in chk.stdout) == (mode != "needs_repair"), chk.stdout
    if mode == "slow":
        import time
        time.sleep(30)
    emit({"type": "result", "subtype": "success", "is_error": False, "result": "完了", "num_turns": 9, "total_cost_usd": 0.5,
          "usage": {"input_tokens": 10, "output_tokens": 20, "cache_creation_input_tokens": 30, "cache_read_input_tokens": 40}})
    return 0


def consult(prompt, mode):
    """院長の気づきの見直し（相談）のまね"""
    assert "CONSULT.md" in prompt and Path("CONSULT.md").exists()
    note = Path("consult.md").read_text(encoding="utf-8")
    assert "試験" not in note and "0099887766" not in note and "架空病院" not in note, "氏名などがAIに渡っている"
    assert "外側の骨に高信号" in note and "s02 の 4〜6枚目" in note and "前回のAIの読影" in note and "骨折を示す所見なし" in note, note
    if "直す所が残っています" in prompt:
        r = json.loads(Path("out/consult.json").read_text(encoding="utf-8"))
        r["verdict"] = "partly"
        Path("out/consult.json").write_text(json.dumps(r, ensure_ascii=False), encoding="utf-8")
        tool("python rt.py check")
        emit({"type": "result", "subtype": "success", "is_error": False, "result": "完了", "num_turns": 2, "total_cost_usd": 0.01})
        return 0
    tool("python rt.py list")
    tool("python rt.py strip s02 4-6 --box 50,90,20,70")
    emit({"type": "assistant", "message": {"content": [{"type": "tool_use", "name": "Read", "input": {"file_path": "views/s02_strip_01.png"}}]}})
    Path("out/fig1.json").write_text(json.dumps({"out": "fig1", "rows": [[
        {"series": "s02", "k": k, "box": [50, 90, 20, 70], "label": f"#{k}", "marks": [{"type": "arrow", "from": [55, 25], "to": [66, 40]}]}
        for k in (4, 5, 6)]]}, ensure_ascii=False), encoding="utf-8")
    tool("python rt.py figure out/fig1.json")
    answer = {
        "verdict": "maybe" if mode == "needs_repair" else "partly",
        "headline": "外側に淡い高信号。骨折線は追えない",
        "answer": ["**外側の骨に淡い高信号があります。** STIR #4〜#6 で連続して見えます。<script>alert(1)</script>",
                   "T1 の同じ所に骨折線は追えません。前回の読影では触れていませんでした。"],
        "sections": [{"heading": "見直した所", "blocks": [{"type": "figure", "file": "figures/fig1.jpg", "caption": "図1 矢状断 STIR #4〜#6"},
                                                       {"type": "p", "text": "同じ枠で並べています。"}]}],
        "next": ["外側の圧痛を確かめる", "腫れが増えるときは医師の再診を"],
    }
    Path("out/consult.json").write_text(json.dumps(answer, ensure_ascii=False), encoding="utf-8")
    emit({"type": "assistant", "message": {"content": [{"type": "tool_use", "name": "Write", "input": {"file_path": "out/consult.json"}}]}})
    chk = tool("python rt.py check")
    assert ("OK" in chk.stdout) == (mode != "needs_repair"), chk.stdout
    emit({"type": "result", "subtype": "success", "is_error": False, "result": "完了", "num_turns": 6, "total_cost_usd": 0.2})
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except AssertionError as e:
        print(json.dumps({"type": "result", "subtype": "error", "is_error": True, "result": f"fake agent assertion: {e}"}, ensure_ascii=False), flush=True)
        sys.exit(1)
