"""
Synthetix-4.0 — Ground Truth Comparison Tool

Compares AI-generated analysis with AMI corpus human annotations.
Standalone script — does NOT modify any existing code.

Usage:
    python3 compare.py ES2002a
    python3 compare.py ES2008d --run-analysis   (also runs the AI analysis live)
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from textwrap import fill

CORPUS_DIR = Path("ami_public_manual_1-2")
MEETINGS_DIR = Path("meetings")

# ── Colors ───────────────────────────────────────────────────────────

GREEN = "\033[92m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
DIM = "\033[2m"
BOLD = "\033[1m"
RESET = "\033[0m"


# ── Parse human annotations ─────────────────────────────────────────

def parse_human_annotations(meeting_id: str) -> dict:
    """Parse the AMI abstractive summary XML for a meeting."""
    abssumm = CORPUS_DIR / "abstractive" / f"{meeting_id}.abssumm.xml"
    if not abssumm.exists():
        return {}

    tree = ET.parse(abssumm)
    root = tree.getroot()

    result = {"abstract": [], "actions": [], "decisions": [], "problems": []}

    for section_tag in ["abstract", "actions", "decisions", "problems"]:
        for section in root.iter(section_tag):
            for sentence in section.iter("sentence"):
                text = (sentence.text or "").strip()
                if text:
                    result[section_tag].append(text)

    return result


# ── Load AI output ───────────────────────────────────────────────────

def load_ai_output(meeting_id: str) -> dict | None:
    """Try to load a cached AI analysis result."""
    # Check for cached result
    cache = Path(f"results/{meeting_id}.json")
    if cache.exists():
        with open(cache) as f:
            return json.load(f)
    return None


def run_analysis(meeting_id: str) -> dict:
    """Run a live analysis via the API."""
    import urllib.request

    url = f"http://localhost:8000/analyze/meeting/{meeting_id}"
    req = urllib.request.Request(url, method="POST", data=b"")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")

    print(f"{DIM}Running AI analysis for {meeting_id} (this takes ~15-25s)...{RESET}")
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())

    # Cache the result
    Path("results").mkdir(exist_ok=True)
    with open(f"results/{meeting_id}.json", "w") as f:
        json.dump(data, f, indent=2)

    return data


# ── Display ──────────────────────────────────────────────────────────

def wrap(text: str, indent: str = "    ") -> str:
    return fill(text, width=80, initial_indent=indent, subsequent_indent=indent)


def print_comparison(meeting_id: str, human: dict, ai: dict | None):
    print(f"\n{'=' * 70}")
    print(f"{BOLD}  COMPARISON: {meeting_id}{RESET}")
    print(f"{'=' * 70}\n")

    # ── Summary ──────────────────────────────────────────────
    print(f"{GREEN}{BOLD}▸ SUMMARY{RESET}")
    print(f"  {DIM}Human (ground truth):{RESET}")
    for s in human.get("abstract", []):
        print(wrap(f"• {s}"))
    print()

    if ai and ai.get("success"):
        print(f"  {CYAN}AI (generated):{RESET}")
        for s in ai.get("meeting_summary", []):
            print(wrap(f"• {s}"))
    elif ai:
        print(f"  {YELLOW}AI: Failsafe triggered (confidence {ai.get('confidence_score', '?')}%){RESET}")
    else:
        print(f"  {DIM}AI: No analysis available (use --run-analysis){RESET}")
    print()

    # ── Decisions ────────────────────────────────────────────
    print(f"{GREEN}{BOLD}▸ DECISIONS{RESET}")
    print(f"  {DIM}Human:{RESET}")
    for s in human.get("decisions", []):
        print(wrap(f"• {s}"))
    if not human.get("decisions"):
        print(f"    {DIM}(none annotated){RESET}")
    print()

    if ai and ai.get("success"):
        print(f"  {CYAN}AI:{RESET}")
        for d in ai.get("key_decisions", []):
            print(wrap(f"• {d['title']}: {d['description']}"))
        if not ai.get("key_decisions"):
            print(f"    {DIM}(none extracted){RESET}")
    print()

    # ── Actions ──────────────────────────────────────────────
    print(f"{GREEN}{BOLD}▸ ACTION ITEMS{RESET}")
    print(f"  {DIM}Human:{RESET}")
    for s in human.get("actions", []):
        print(wrap(f"• {s}"))
    if not human.get("actions"):
        print(f"    {DIM}(none annotated){RESET}")
    print()

    if ai and ai.get("success"):
        print(f"  {CYAN}AI:{RESET}")
        for a in ai.get("action_items", []):
            owner = a.get("owner", "?")
            print(wrap(f"• [{owner}] {a['task']}"))
        if not ai.get("action_items"):
            print(f"    {DIM}(none extracted){RESET}")
    print()

    # ── Problems / Risks ─────────────────────────────────────
    print(f"{GREEN}{BOLD}▸ RISKS / OPEN QUESTIONS{RESET}")
    print(f"  {DIM}Human:{RESET}")
    for s in human.get("problems", []):
        print(wrap(f"• {s}"))
    if not human.get("problems"):
        print(f"    {DIM}(none annotated){RESET}")
    print()

    if ai and ai.get("success"):
        print(f"  {CYAN}AI:{RESET}")
        for r in ai.get("risks_and_open_questions", []):
            print(wrap(f"• {r['title']}: {r['description']}"))
        if not ai.get("risks_and_open_questions"):
            print(f"    {DIM}(none extracted){RESET}")
    print()

    # ── Confidence ───────────────────────────────────────────
    if ai:
        score = ai.get("confidence_score", "?")
        label = ai.get("confidence_label", "")
        color = GREEN if isinstance(score, int) and score >= 70 else YELLOW
        print(f"  {color}Confidence: {score}%{RESET} — {label}")
        if ai.get("metadata"):
            print(f"  {DIM}Model: {ai['metadata']['model']} | Time: {ai['metadata']['processing_time_sec']}s{RESET}")

    print(f"\n{'=' * 70}\n")


# ── Main ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Compare AI vs Human annotations")
    parser.add_argument("meeting_id", help="Meeting ID (e.g., ES2002a)")
    parser.add_argument("--run-analysis", action="store_true", help="Run live AI analysis via the API")
    args = parser.parse_args()

    mid = args.meeting_id

    # Parse human annotations
    human = parse_human_annotations(mid)
    if not human or not any(human.values()):
        print(f"No human annotations found for {mid}.")
        print(f"Only 'ES*' and 'IS*' meetings have abstractive summaries in the AMI corpus.")
        sys.exit(1)

    # Get AI output
    ai = load_ai_output(mid)
    if not ai and args.run_analysis:
        ai = run_analysis(mid)
    
    print_comparison(mid, human, ai)


if __name__ == "__main__":
    main()
