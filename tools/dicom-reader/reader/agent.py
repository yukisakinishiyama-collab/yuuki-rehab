"""このパソコンの Claude Code（院長の Claude のプラン）に読影をさせる。

- 作業フォルダの中だけを読み書きさせる（--restricted）。動かせるのは `python rt.py …` だけ
- つないであるコネクタ・スキルは読み込ませない（--strict-mcp-config・--disable-slash-commands）。
  これを付けないと、関係のない道具の説明が毎回数十万トークン読み込まれ、使用枠をすぐ使い切る
- 途中経過は stream-json の1行ずつから拾って、画面に出す
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
from pathlib import Path

PROMPT = """このフォルダの INSTRUCTIONS.md を最初に読み、その手順どおりに case.md の症例の画像所見レポートを作ってください。

- 道具は `python rt.py …` だけです（`python rt.py -h`）。画像は views/ に出るので Read で開きます
- 成果物は out/report.json と figures/ の図です。`python rt.py check` が OK と出るまで直してください
- このフォルダの外は読まない・書かない。質問はせず、最後まで自分で進めてください
- 終わったら「完了」とだけ答えてください
"""
REPAIR_PROMPT = """out/report.json に直す所が残っています。`python rt.py check` を実行し、指摘をすべて直して OK にしてください。
読影のやり直しは不要です（INSTRUCTIONS.md の「out/report.json の形」に合わせるだけ）。終わったら「完了」とだけ答えてください。
"""

LIMIT_HINTS = ("hit your", "usage limit", "session limit", "weekly limit", "rate limit", "overloaded", "quota")
AUTH_HINTS = ("authenticate", "oauth", "/login", "log in", "logged in", "unauthorized", "401", "api key", "credentials")

STAGE_JA = [
    (re.compile(r"rt\.py\s+list"), "シリーズの条件と向きを確かめています"),
    (re.compile(r"rt\.py\s+montage\s+(\S+)"), "全スライスを見ています"),
    (re.compile(r"rt\.py\s+strip\s+(\S+)"), "連続スライスを追っています"),
    (re.compile(r"rt\.py\s+view\s+(\S+)"), "拡大して確かめています"),
    (re.compile(r"rt\.py\s+(roi|dist|xref)"), "信号・大きさを測っています"),
    (re.compile(r"rt\.py\s+figure"), "レポートの図を作っています"),
    (re.compile(r"rt\.py\s+check"), "レポートを点検しています"),
]


def find_claude(configured=None) -> list[str] | None:
    if configured:
        return list(configured) if isinstance(configured, (list, tuple)) else [str(configured)]
    cands = []
    appdata = os.environ.get("APPDATA")
    if appdata:
        cands.append(Path(appdata) / "npm" / "node_modules" / "@anthropic-ai" / "claude-code" / "bin" / "claude.exe")
    home = Path.home()
    cands += [home / ".local" / "bin" / "claude.exe", home / ".local" / "bin" / "claude", home / ".claude" / "local" / "claude.exe"]
    for c in cands:
        if c.is_file():
            return [str(c)]
    w = shutil.which("claude")
    return [w] if w else None


def agent_env(python_dir: str | None = None) -> dict:
    env = dict(os.environ, PYTHONIOENCODING="utf-8", PYTHONUTF8="1", NO_COLOR="1")
    # ほかの Claude の画面から起動されたときに、その画面の続きだと思わせない
    for k in list(env):
        if k.upper().startswith("CLAUDE") and k.upper() not in ("CLAUDE_CODE_GIT_BASH_PATH", "CLAUDE_CONFIG_DIR"):
            env.pop(k)
    env["PATH"] = (python_dir or str(Path(sys.executable).parent)) + os.pathsep + env.get("PATH", "")
    return env


def _popen_kw() -> dict:
    return {"creationflags": 0x08000000} if os.name == "nt" else {"start_new_session": True}


def login_status(claude: list[str], timeout: int = 25) -> dict:
    """トークンを使わずに、ログインしているかだけ聞く。"""
    try:
        r = subprocess.run([*claude, "auth", "status"], capture_output=True, timeout=timeout, env=agent_env(), **_popen_kw())
        d = json.loads((r.stdout or b"{}").decode("utf-8", "replace") or "{}")
        return {"logged_in": bool(d.get("loggedIn")), "plan": d.get("subscriptionType") or ""}
    except Exception as e:  # noqa: BLE001
        return {"logged_in": None, "error": str(e)[:200]}


def build_command(claude: list[str], work: Path, cfg: dict) -> list[str]:
    settings = Path(work) / "_claude_settings.json"
    settings.write_text(json.dumps({"permissions": {"deny": ["Read(./_claude_settings.json)", "Edit(./rt.py)", "Edit(./rtlib.py)",
                                                             "Edit(./rtcheck.py)", "Edit(./series/**)", "Edit(./case.md)",
                                                             "Edit(./INSTRUCTIONS.md)"]}}), encoding="utf-8")
    argv = [*claude, "-p", "--output-format", "stream-json", "--verbose", "--no-session-persistence",
            "--permission-mode", "dontAsk", "--restricted", "--strict-mcp-config", "--disable-slash-commands",
            "--tools", "Read,Glob,Grep,Write,Edit,Bash,PowerShell", "--settings", str(settings),
            "--allowedTools", "Read,Glob,Grep,Edit(./out/**),Bash(python rt.py *),PowerShell(python rt.py *)"]
    if cfg.get("model"):
        argv += ["--model", str(cfg["model"])]
    if cfg.get("effort"):
        argv += ["--effort", str(cfg["effort"])]
    return argv


def kill_tree(proc: subprocess.Popen) -> None:
    try:
        if os.name == "nt":
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True, timeout=30, **_popen_kw())
        else:
            import signal
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
    except Exception:  # noqa: BLE001
        try:
            proc.kill()
        except Exception:  # noqa: BLE001
            pass


def explain(message: str) -> tuple[str, str] | None:
    """(種類, 日本語の説明)。使用枠・ログイン切れのときだけ。"""
    m = (message or "").lower()
    if any(h in m for h in LIMIT_HINTS):
        t = re.search(r"resets?\s+(?:at\s+)?([0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm)?)", message or "", re.I)
        when = f"（{t.group(1).strip()} ごろに戻ります）" if t else ""
        return "limit", f"Claude の使用枠に達しました{when}。時間をおいて、もう一度「読影を始める」を押してください。"
    if any(h in m for h in AUTH_HINTS):
        return "login", "このパソコンの Claude Code のログインが切れています。コマンドプロンプトで claude を起動し、/login でログインし直してください。"
    return None


def run(claude: list[str], work: Path, cfg: dict, prompt: str, on_stage, proc_holder: dict, timeout: int = 2700) -> dict:
    """戻り値: {ok, message, kind, turns, cost_usd, seconds, tokens}"""
    work = Path(work)
    (work / "out").mkdir(exist_ok=True)
    log = open(work / "out" / f"agent_{time.strftime('%H%M%S')}.log", "w", encoding="utf-8")
    t0 = time.time()
    proc = subprocess.Popen(build_command(claude, work, cfg), cwd=str(work), stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, env=agent_env(cfg.get("python_dir")), **_popen_kw())
    proc_holder["proc"] = proc
    result: dict = {}
    counts = {"tools": 0, "reads": 0}
    err_tail: list[str] = []

    def read_err():
        for line in iter(proc.stderr.readline, b""):
            err_tail.append(line.decode("utf-8", "replace"))
            del err_tail[:-40]

    threading.Thread(target=read_err, daemon=True).start()
    timer = threading.Timer(timeout, lambda: (result.setdefault("timed_out", True), kill_tree(proc)))
    timer.daemon = True
    timer.start()
    try:
        proc.stdin.write(prompt.encode("utf-8"))
        proc.stdin.close()
        for raw in iter(proc.stdout.readline, b""):
            line = raw.decode("utf-8", "replace").strip()
            if not line:
                continue
            try:
                ev = json.loads(line)
            except ValueError:
                log.write(line + "\n")
                continue
            t = ev.get("type")
            if t == "assistant":
                for c in (ev.get("message") or {}).get("content") or []:
                    if c.get("type") != "tool_use":
                        continue
                    counts["tools"] += 1
                    inp = c.get("input") or {}
                    cmd = str(inp.get("command") or "")
                    log.write(f"[{time.strftime('%H:%M:%S')}] {c.get('name')} {cmd or inp.get('file_path') or ''}\n")
                    log.flush()
                    if c.get("name") == "Read" and re.search(r"\.(png|jpg)$", str(inp.get("file_path") or ""), re.I):
                        counts["reads"] += 1
                    for pat, ja in STAGE_JA:
                        if pat.search(cmd):
                            on_stage(ja, counts)
                            break
                    else:
                        if c.get("name") in ("Write", "Edit") and "report.json" in str(inp.get("file_path") or ""):
                            on_stage("レポートを書いています", counts)
            elif t == "result":
                result.update(ev)
                log.write(json.dumps({k: ev.get(k) for k in ("subtype", "is_error", "num_turns", "total_cost_usd", "duration_ms", "usage")},
                                     ensure_ascii=False) + "\n")
        proc.wait(timeout=60)
    finally:
        timer.cancel()
        if proc.poll() is None:
            kill_tree(proc)
        log.close()
        proc_holder.pop("proc", None)
    secs = round(time.time() - t0)
    message = str(result.get("result") or "") or "".join(err_tail)[-1500:]
    ok = proc.returncode == 0 and not result.get("is_error") and not result.get("timed_out") and bool(result)
    usage = result.get("usage") or {}
    out = {"ok": ok, "message": message[-1500:], "kind": None, "turns": result.get("num_turns"), "cost_usd": result.get("total_cost_usd"),
           "seconds": secs, "images_read": counts["reads"],
           "tokens": {k: usage.get(k) for k in ("input_tokens", "output_tokens", "cache_creation_input_tokens", "cache_read_input_tokens")}}
    if result.get("timed_out"):
        out.update(kind="timeout", message=f"時間切れ（{timeout // 60}分）で止めました。")
    elif not ok:
        ex = explain(message)
        if ex:
            out.update(kind=ex[0], message=ex[1])
    return out
