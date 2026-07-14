# pipeline_core.py
# Pure logic — no print(), no input(), no __main__.
# Imported by orchestrate.py (CLI) and orchestration_mcp.py (MCP server).

import os
import re
import subprocess
import threading
from datetime import datetime
from pathlib import Path
from typing import TypedDict

import requests
from dotenv import load_dotenv

# Load .env from project root if present — never required, always optional.
# Precedence: environment variables > .env file > built-in defaults.
load_dotenv(dotenv_path=Path(".env"), override=False)

# ─── config (all overridable via env or .env) ─────────────────────────────────
OLLAMA_URL      = os.environ.get("OLLAMA_URL",      "http://localhost:11434/api/generate")
ROUTING_MODEL   = os.environ.get("ROUTING_MODEL",   "phi3:mini")
COMPILE_MODEL   = os.environ.get("COMPILE_MODEL",   "qwen2.5-coder:3b")
VRAM_THRESHOLD  = float(os.environ.get("VRAM_THRESHOLD", "0.8"))   # GB — fall back to ROUTING_MODEL below this

from lang import (
    extract_files,
    fingerprint_project,
    fingerprint_summary,
    blast_radius_grep,
    run_tests,
    langs_in_files,
    detect_language,
)


# ─── types ────────────────────────────────────────────────────────────────────

class CompileResult(TypedDict):
    prompt: str
    target_files: list[str]
    blast: str
    failures_injected: bool
    languages: set[str]

class VerifyResult(TypedDict):
    verdict: str
    passed: bool
    test_output: str
    diff_summary: str
    retry_context: str

# ─── file helpers ─────────────────────────────────────────────────────────────

def read_file(name: str, fallback: str = "") -> str:
    try:
        return Path(name).read_text()
    except FileNotFoundError:
        return fallback

def ensure_files() -> list[str]:
    defaults = {
        "ARCHITECTURE.md": "# Architecture\n## Data flow\n## Key decisions\n",
        "SESSION.md":      "# Session state\n## What just changed\n- Session started\n## Active constraints\n- None yet\n",
        "DECISIONS.md":    "# Decisions log\n",
        "FAILURES.md":     "# Failure log\n",
    }
    created = []
    for name, content in defaults.items():
        p = Path(name)
        if not p.exists():
            p.write_text(content)
            created.append(name)
    return created

# ─── local model ──────────────────────────────────────────────────────────────

def vram_free_gb() -> float:
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.free", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=3,
        )
        return int(result.stdout.strip().splitlines()[0]) / 1024
    except Exception:
        return 99.0

def pick_model(role: str) -> str:
    if vram_free_gb() < VRAM_THRESHOLD:
        return ROUTING_MODEL
    return ROUTING_MODEL if role == "routing" else COMPILE_MODEL

def ask_local(model: str, prompt: str) -> str:
    try:
        r = requests.post(
            OLLAMA_URL,
            json={"model": model, "prompt": prompt, "stream": False},
            timeout=120,
        )
        r.raise_for_status()
        return r.json()["response"]
    except Exception as e:
        return f"[ollama error: {e}]"

# ─── git ──────────────────────────────────────────────────────────────────────

def git_diff(max_chars: int = 2400) -> str:
    return subprocess.run(
        ["git", "diff", "HEAD~1"], capture_output=True, text=True
    ).stdout[:max_chars]

def git_diff_head(max_chars: int = 3000) -> str:
    return subprocess.run(
        ["git", "diff", "HEAD"], capture_output=True, text=True
    ).stdout[:max_chars]

# ─── context maintenance ──────────────────────────────────────────────────────

def maybe_prune_decisions() -> None:
    content = read_file("DECISIONS.md")
    if content.count("\n[") > 20:
        pruned = ask_local(pick_model("routing"), f"""
Compress these DECISIONS.md entries.
Keep: the 5 most recent entries verbatim.
Compress: all older entries into a single '## Earlier decisions' paragraph.
{content}
""")
        if pruned and not pruned.startswith("[ollama"):
            Path("DECISIONS.md").write_text(pruned)

def _update_session(task: str, diff_summary: str) -> None:
    current = read_file("SESSION.md")
    updated = ask_local(pick_model("routing"), f"""
Update this SESSION.md to reflect a completed task.
Current SESSION.md:
{current}

Completed task: {task}
What changed: {diff_summary}

Return the full updated SESSION.md. Keep it under 400 words.
Prune anything older than 3 changes from 'What just changed'.
""")
    if updated and not updated.startswith("[ollama"):
        Path("SESSION.md").write_text(updated)

# Background thread reference — stored so orchestrate.py CLI can join it
# before exit, preventing the daemon-kill race. The MCP server is long-lived
# so it doesn't need to join — the thread finishes naturally.
_bg_thread: threading.Thread | None = None

def update_session_async(task: str, diff_summary: str) -> None:
    global _bg_thread
    _bg_thread = threading.Thread(
        target=_update_session,
        args=(task, diff_summary),
        daemon=True,   # still daemon so it can't block the MCP server forever
    )
    _bg_thread.start()

def wait_for_background_tasks(timeout: float = 8.0) -> None:
    """
    Block until the background SESSION.md update finishes or timeout expires.
    Call this at the end of the CLI run_task() — not needed in the MCP server
    since the process stays alive and the thread completes naturally.
    timeout=8s: long enough for a local Ollama call, short enough not to
    visibly stall the terminal if Ollama is unresponsive.
    """
    if _bg_thread is not None and _bg_thread.is_alive():
        _bg_thread.join(timeout=timeout)

def log_decision(task: str, diff_summary: str, affected_files: str) -> None:
    ts = datetime.now().strftime("%H:%M")
    entry = ask_local(pick_model("routing"), f"""
Write one DECISIONS.md entry.
Task: {task}
Approach: {diff_summary}
Files affected: {affected_files}
Format exactly:
[{ts}] one-line decision summary — phi3:mini
reason: one sentence
affects: comma-separated files
""")
    if entry and not entry.startswith("[ollama"):
        with open("DECISIONS.md", "a") as f:
            f.write("\n" + entry.strip())

def log_failure(task: str, bad_prompt: str, reason: str) -> None:
    with open("FAILURES.md", "a") as f:
        f.write(f"\n[{task}]\nbad: {bad_prompt[:200]}\nfix: {reason}\n")

# ─── context retrieval ────────────────────────────────────────────────────────

def get_relevant_failures(task: str) -> str:
    failures = read_file("FAILURES.md")
    if len(failures) < 100:
        return "none"
    return ask_local(pick_model("routing"), f"""
Task: "{task}"
Past failures:
{failures[-2000:]}
Which 2-3 past failures are most relevant? Return them verbatim.
If none are relevant, reply: none
""")

def blast_radius(target_files: list[str]) -> str:
    """Multi-language blast radius: finds files that import the targets."""
    hits = blast_radius_grep(target_files)
    if not hits:
        return "No files found that import these targets."

    langs = langs_in_files(hits)
    return ask_local(pick_model("routing"), f"""
These files ({', '.join(langs)}) import the files being modified:
{chr(10).join(hits)}
List the 3 most likely things to break across the codebase. Be specific, one line each.
""")

# ─── core: compile ────────────────────────────────────────────────────────────

def compile_prompt(task: str) -> CompileResult:
    """
    Build a precise, language-aware agent prompt from live context.
    Works for Python, JS/TS/React, Rust, Go, and mixed projects.
    """
    ensure_files()
    maybe_prune_decisions()

    arch      = read_file("ARCHITECTURE.md", "(no architecture file yet)")
    session   = read_file("SESSION.md",      "(no session file yet)")
    decisions = read_file("DECISIONS.md",    "(no decisions yet)")
    diff      = git_diff()

    # Project fingerprint — tells the routing model what kind of project this is
    fp = fingerprint_project()
    fp_summary = fingerprint_summary(fp)

    routing = ask_local(pick_model("routing"), f"""
Task: "{task}"
Project shape:
{fp_summary}
Current session: {session}
Recent decisions: {decisions[-800:]}
List the 2-3 most relevant files (include extension) and any hard constraints. Be concise.
""")

    target_files = extract_files(routing)
    languages = langs_in_files(target_files) or {fp["primary_language"].lstrip(".")}

    # Language-specific conventions injected into the compiled prompt
    lang_notes = _language_notes(languages, fp)

    compiled = ask_local(pick_model("compiling"), f"""
Build a precise agent prompt for this task: "{task}"
Languages involved: {', '.join(languages)}
Routing analysis: {routing}
Recent git diff: {diff[:1200]}
Architecture: {arch[:600]}
Language conventions to follow:
{lang_notes}
Format: Task / Target files / Recent changes summary / Hard constraints / Behavioral assertions to satisfy
""")

    failures_str = get_relevant_failures(task)
    injected = bool(failures_str and "none" not in failures_str.lower())
    if injected:
        compiled += f"\n\nPAST FAILURES ON SIMILAR TASKS — avoid these:\n{failures_str}"

    blast = blast_radius(target_files)
    compiled += f"\n\nBLAST RADIUS WARNING:\n{blast}\nDo not break these."

    return CompileResult(
        prompt=compiled,
        target_files=target_files,
        blast=blast,
        failures_injected=injected,
        languages=languages,
    )

def _language_notes(languages: set[str], fp: dict) -> str:
    """Return language-specific conventions to inject into compiled prompts."""
    notes = []

    if "python" in languages:
        notes.append("Python: use type hints, avoid mutable defaults, prefer pathlib over os.path.")

    if "react" in languages or "typescript" in languages or "javascript" in languages:
        pm = fp["package_managers"][0] if fp["package_managers"] else "npm"
        notes.append(f"JS/TS: use {pm} for deps. Prefer named exports. No `any` in TypeScript.")
        if "react" in languages:
            notes.append("React: functional components only, hooks for state, no class components.")

    if "css/scss" in languages:
        notes.append("CSS: use CSS custom properties for theming, avoid !important.")

    if "rust" in languages:
        notes.append("Rust: handle all Result/Option explicitly, no unwrap() in library code.")

    if "go" in languages:
        notes.append("Go: explicit error handling, no panics in library code, idiomatic naming.")

    return "\n".join(notes) if notes else "No specific conventions detected."

# ─── core: verify + commit ────────────────────────────────────────────────────

def _discover_changed_files() -> list[str]:
    """
    Ask git what files actually changed or were created since the last commit.
    This is the ground truth for new-file tasks where compile_prompt had no
    existing files to extract — routing returns empty, but git knows what landed.
    Returns relative paths of all modified/added files, excluding deletions.
    """
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        capture_output=True, text=True,
    )
    files = []
    for line in result.stdout.splitlines():
        if len(line) < 4:
            continue
        status = line[:2].strip()
        path   = line[3:].strip()
        # M=modified, A=added, ??=untracked — all mean "something is on disk now"
        # D=deleted — skip, nothing to test
        if status not in ("D", "DD", "RD"):
            # handle renames: "R old -> new"
            if " -> " in path:
                path = path.split(" -> ")[-1]
            files.append(path)
    return files

def verify_and_commit(task: str, target_files: list[str], original_prompt: str) -> VerifyResult:
    """
    Run the real test suite for whatever languages are involved.
    Completely subprocess-based — the IDE agent cannot influence the result.

    New-file handling: if target_files is empty (new feature task where the file
    didn't exist at compile time), we discover what git sees on disk right now
    and use that as the actual file list for targeted test selection.

    On PASS: updates context files.
    On FAIL: returns retry context with real test output.
    """
    # ── Bug 1 fix: discover real files if routing returned nothing ───────────
    effective_files = target_files
    is_new_file_task = not any(Path(f).exists() for f in target_files)

    if is_new_file_task:
        discovered = _discover_changed_files()
        if discovered:
            effective_files = discovered
            # also update target_files so log_decision uses real names
            target_files = discovered

    # ── Bug 3 fix: confirm files are actually on disk before running tests ────
    # The IDE agent sometimes calls verify_and_save_task immediately after
    # generating code, before the IDE has flushed writes to disk.
    # git status --porcelain returns nothing if no files have changed yet.
    # We catch that and return a WAIT signal so the agent retries without
    # regenerating code.
    changed_on_disk = _discover_changed_files()
    if not changed_on_disk:
        return VerifyResult(
            verdict="WAIT",
            passed=False,
            test_output="",
            diff_summary="",
            retry_context=(
                "No file changes detected on disk yet. "
                "The IDE has not finished writing files. "
                "Wait a moment, then call verify_and_save_task again. "
                "Do NOT regenerate the code — just retry this call."
            ),
        )

    test_output = run_tests(effective_files)

    verdict_raw = ask_local(pick_model("compiling"), f"""
Tests ran after the change was applied. Raw output:
{test_output}
Reply PASS or FAIL with one line reason.
Be strict: any error, any failing test, any unresolved import = FAIL.
""")

    passed = "PASS" in verdict_raw.upper()
    diff_summary = ""
    retry_context = ""

    if passed:
        diff = git_diff_head()
        diff_summary = ask_local(
            pick_model("routing"),
            f"Summarize this diff in 2 sentences:\n{diff[:1500]}"
        )
        affected = ", ".join(target_files) or "auto-detected"
        update_session_async(task, diff_summary)
        log_decision(task, diff_summary, affected)
        maybe_prune_decisions()
    else:
        log_failure(task, original_prompt[:300], verdict_raw)
        retry_context = (
            f"Previous attempt FAILED.\n"
            f"Reason: {verdict_raw}\n\n"
            f"Test output:\n{test_output[-800:]}\n\n"
            f"Constraints from original prompt:\n{original_prompt[-400:]}\n\n"
            f"Fix only what broke the tests. Do not change the overall approach."
        )

    return VerifyResult(
        verdict=verdict_raw,
        passed=passed,
        test_output=test_output,
        diff_summary=diff_summary,
        retry_context=retry_context,
    )
