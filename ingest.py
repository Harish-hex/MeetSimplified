"""
Ingestion layer for Synthetix-4.0.

Loads transcript files (.json JSONL or .txt), computes running
timestamps, and builds a numbered transcript string ready for
LLM analysis.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import List, Optional

from models import Meeting, Segment

logger = logging.getLogger(__name__)


# ── Helpers ──────────────────────────────────────────────────────────


def _fmt_time(seconds: float) -> str:
    """Format seconds to HH:MM:SS string."""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    if h > 0:
        return f"{h:02d}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"


def _fmt_duration(seconds: float) -> str:
    """Human-readable duration like '1h 23m 45s'."""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    parts: List[str] = []
    if h > 0:
        parts.append(f"{h}h")
    if m > 0:
        parts.append(f"{m}m")
    parts.append(f"{s}s")
    return " ".join(parts)


# ── JSONL loader ─────────────────────────────────────────────────────


def _load_jsonl(content: str) -> List[dict]:
    """
    Parse JSONL content (one JSON object per line).
    Skips blank lines and logs malformed ones.
    """
    records: List[dict] = []
    for i, line in enumerate(content.splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        try:
            records.append(json.loads(line))
        except json.JSONDecodeError:
            logger.warning("Skipping malformed JSON on line %d", i)
    return records


# ── TXT loader ───────────────────────────────────────────────────────


def _load_txt(content: str) -> List[dict]:
    """
    Parse a plain text transcript.
    Each non-empty line becomes a segment with an estimated duration.
    """
    records: List[dict] = []
    for line in content.splitlines():
        line = line.strip()
        if not line:
            continue
        # Estimate ~150 words/min speaking rate → duration from word count
        word_count = len(line.split())
        est_duration = max(1.0, (word_count / 150) * 60)
        records.append({
            "text": line,
            "duration": round(est_duration, 2),
            "audio_filepath": "",
        })
    return records


# ── Public API ───────────────────────────────────────────────────────


def load_transcript(
    file_bytes: bytes,
    filename: str,
    meeting_date: Optional[str] = None,
    attendees: Optional[List[str]] = None,
) -> Meeting:
    """
    Load a transcript from uploaded file bytes.

    Args:
        file_bytes:   Raw bytes of the uploaded file.
        filename:     Original filename (used to detect format).
        meeting_date: Optional date string from the form.
        attendees:    Optional list of attendee names from the form.

    Returns:
        A Meeting object with computed timestamps and a
        numbered transcript string ready for LLM analysis.
    """
    content = file_bytes.decode("utf-8", errors="replace")

    # Detect format from extension.
    ext = Path(filename).suffix.lower()
    if ext == ".json":
        records = _load_jsonl(content)
    elif ext == ".txt":
        records = _load_txt(content)
    else:
        # Try JSONL first, fall back to TXT.
        try:
            records = _load_jsonl(content)
            if not records:
                raise ValueError("empty")
        except Exception:
            records = _load_txt(content)

    if not records:
        raise ValueError("Transcript file is empty or could not be parsed.")

    # Build segments with running timestamps.
    segments: List[Segment] = []
    running_time = 0.0

    for idx, rec in enumerate(records, start=1):
        duration = float(rec.get("duration", 1.0))
        start = running_time
        end = running_time + duration

        segments.append(Segment(
            id=idx,
            start_time=round(start, 3),
            end_time=round(end, 3),
            start_time_human=_fmt_time(start),
            text=rec.get("text", rec.get("text_raw", "")),
            audio_filepath=rec.get("audio_filepath", ""),
        ))
        running_time = end

    total = running_time

    # Build a numbered transcript string for the LLM.
    # Format: [1] 00:00:00 — "text here"
    transcript_lines: List[str] = []
    for seg in segments:
        transcript_lines.append(
            f"[{seg.id}] {seg.start_time_human} — \"{seg.text}\""
        )
    raw_transcript = "\n".join(transcript_lines)

    logger.info(
        "Loaded %d segments, total duration: %s",
        len(segments),
        _fmt_duration(total),
    )

    return Meeting(
        segments=segments,
        total_duration_sec=round(total, 3),
        total_duration_human=_fmt_duration(total),
        raw_transcript=raw_transcript,
        attendees=attendees or [],
        meeting_date=meeting_date,
    )
