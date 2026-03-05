"""
AMI Corpus → JSONL Converter for Synthetix-4.0.

Converts the AMI Meeting Corpus XML format into JSONL files
that the Synthetix /analyze endpoint can consume.

Usage:
    python3 ami_to_json.py ami_public_manual_1-2 --meeting ES2002a -o meetings/ES2002a.json
    python3 ami_to_json.py ami_public_manual_1-2 --all -o meetings/

The output JSONL format (one JSON object per line):
    {"speaker": "A", "text": "Hi, I'm David and I'm supposed to be an industrial designer.", "start_time": 77.44, "end_time": 80.87, "duration": 3.43}
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
import xml.etree.ElementTree as ET
from html import unescape
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
)
logger = logging.getLogger(__name__)


# ── XML Parsing Helpers ──────────────────────────────────────────────

NS = {"nite": "http://nite.sourceforge.net/"}


def _clean_text(raw: str) -> str:
    """Clean XML entity-encoded text (e.g., &#39; → ')."""
    return unescape(raw).strip()


def _parse_words(words_path: Path) -> Dict[str, dict]:
    """
    Parse a words XML file and return a dict mapping word ID
    to {text, starttime, endtime, is_punc, is_vocal}.
    """
    tree = ET.parse(words_path)
    root = tree.getroot()
    words: Dict[str, dict] = {}

    for elem in root:
        tag = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag
        word_id = elem.attrib.get(f"{{{NS['nite']}}}id", "")

        if tag == "w":
            start = elem.attrib.get("starttime", "")
            end = elem.attrib.get("endtime", "")
            is_punc = elem.attrib.get("punc", "false") == "true"
            text = _clean_text(elem.text or "")

            words[word_id] = {
                "text": text,
                "starttime": float(start) if start else None,
                "endtime": float(end) if end else None,
                "is_punc": is_punc,
                "is_vocal": False,
            }
        elif tag == "vocalsound":
            # Skip vocal sounds (laughs, etc.) for clean text.
            start = elem.attrib.get("starttime", "")
            end = elem.attrib.get("endtime", "")
            words[word_id] = {
                "text": "",
                "starttime": float(start) if start else None,
                "endtime": float(end) if end else None,
                "is_punc": False,
                "is_vocal": True,
            }

    return words


def _parse_segments(seg_path: Path) -> List[dict]:
    """
    Parse a segments XML file and return a list of
    {id, start, end, word_range: (first_id, last_id)}.
    """
    tree = ET.parse(seg_path)
    root = tree.getroot()
    segments: List[dict] = []

    for seg in root:
        tag = seg.tag.split("}")[-1] if "}" in seg.tag else seg.tag
        if tag != "segment":
            continue

        seg_id = seg.attrib.get(f"{{{NS['nite']}}}id", "")
        start = float(seg.attrib.get("transcriber_start", 0))
        end = float(seg.attrib.get("transcriber_end", 0))

        # Parse child href to get word range.
        word_start = None
        word_end = None
        for child in seg:
            href = child.attrib.get("href", "")
            # Format: "ES2002a.A.words.xml#id(ES2002a.A.words0)..id(ES2002a.A.words12)"
            # or single: "ES2002a.A.words.xml#id(ES2002a.A.words49)"
            match = re.search(r"id\(([^)]+)\)(?:\.\.id\(([^)]+)\))?", href)
            if match:
                word_start = match.group(1)
                word_end = match.group(2) or match.group(1)

        segments.append({
            "id": seg_id,
            "start": start,
            "end": end,
            "word_start": word_start,
            "word_end": word_end,
        })

    return segments


def _assemble_segment_text(
    segment: dict, words: Dict[str, dict]
) -> Optional[str]:
    """
    Given a segment and a words dict, assemble the text for
    all words in the segment's word range.
    """
    if not segment["word_start"] or not segment["word_end"]:
        return None

    # Get ordered word IDs.
    word_ids = list(words.keys())
    try:
        start_idx = word_ids.index(segment["word_start"])
        end_idx = word_ids.index(segment["word_end"])
    except ValueError:
        return None

    parts: List[str] = []
    for wid in word_ids[start_idx : end_idx + 1]:
        w = words[wid]
        if w["is_vocal"]:
            continue  # Skip vocal sounds
        if not w["text"]:
            continue
        if w["is_punc"]:
            # Attach punctuation to previous word (no space).
            if parts:
                parts[-1] += w["text"]
            continue
        parts.append(w["text"])

    text = " ".join(parts).strip()
    return text if text else None


# ── Meeting Assembly ─────────────────────────────────────────────────


def _get_meeting_ids(corpus_dir: Path) -> Set[str]:
    """Find all unique meeting IDs from the words directory."""
    words_dir = corpus_dir / "words"
    if not words_dir.exists():
        return set()

    meeting_ids: Set[str] = set()
    for f in words_dir.iterdir():
        if f.suffix == ".xml" and ".words." in f.name:
            # e.g., ES2002a.A.words.xml → ES2002a
            meeting_id = f.name.split(".")[0]
            meeting_ids.add(meeting_id)

    return meeting_ids


def _get_speaker_files(
    corpus_dir: Path, meeting_id: str
) -> List[Tuple[str, Path, Path]]:
    """
    Get (speaker_label, words_path, segments_path) for each
    speaker in a meeting.
    """
    words_dir = corpus_dir / "words"
    segs_dir = corpus_dir / "segments"
    speakers: List[Tuple[str, Path, Path]] = []

    for f in sorted(words_dir.glob(f"{meeting_id}.*.words.xml")):
        # e.g., ES2002a.A.words.xml → speaker "A"
        parts = f.name.split(".")
        if len(parts) >= 3:
            speaker = parts[1]
            seg_file = segs_dir / f"{meeting_id}.{speaker}.segments.xml"
            if seg_file.exists():
                speakers.append((speaker, f, seg_file))
            else:
                logger.warning("No segments file for %s speaker %s", meeting_id, speaker)

    return speakers


def convert_meeting(corpus_dir: Path, meeting_id: str) -> List[dict]:
    """
    Convert a single AMI meeting to a list of JSONL records,
    sorted chronologically by start time.
    """
    speakers = _get_speaker_files(corpus_dir, meeting_id)
    if not speakers:
        logger.error("No speaker data found for meeting %s", meeting_id)
        return []

    all_utterances: List[dict] = []

    for speaker_label, words_path, segs_path in speakers:
        words = _parse_words(words_path)
        segments = _parse_segments(segs_path)

        for seg in segments:
            text = _assemble_segment_text(seg, words)
            if not text:
                continue

            duration = round(seg["end"] - seg["start"], 3)
            if duration <= 0:
                continue

            all_utterances.append({
                "speaker": f"Speaker {speaker_label}",
                "text": f"Speaker {speaker_label}: {text}",
                "start_time": round(seg["start"], 3),
                "end_time": round(seg["end"], 3),
                "duration": duration,
            })

    # Sort by start time to get chronological order.
    all_utterances.sort(key=lambda u: u["start_time"])

    logger.info(
        "Meeting %s: %d speakers, %d utterances, %.1fs total",
        meeting_id,
        len(speakers),
        len(all_utterances),
        all_utterances[-1]["end_time"] - all_utterances[0]["start_time"]
        if all_utterances
        else 0,
    )

    return all_utterances


def save_jsonl(records: List[dict], output_path: Path) -> None:
    """Save records as JSONL (one JSON object per line)."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        for rec in records:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    logger.info("Saved %d records to %s", len(records), output_path)


# ── CLI ──────────────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(
        description="Convert AMI Corpus XML to JSONL for Synthetix-4.0",
    )
    parser.add_argument(
        "corpus_dir",
        type=Path,
        help="Path to the AMI corpus directory (e.g., ami_public_manual_1-2)",
    )
    parser.add_argument(
        "--meeting",
        type=str,
        default=None,
        help="Convert a specific meeting ID (e.g., ES2002a). If omitted with --all, converts all meetings.",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        dest="convert_all",
        help="Convert all meetings in the corpus.",
    )
    parser.add_argument(
        "-o", "--output",
        type=Path,
        default=None,
        help="Output file path (.json) or directory (with --all).",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        dest="list_meetings",
        help="List all available meeting IDs and exit.",
    )

    args = parser.parse_args()
    corpus = args.corpus_dir

    if not corpus.exists():
        print(f"Error: corpus directory '{corpus}' does not exist.", file=sys.stderr)
        sys.exit(1)

    meeting_ids = sorted(_get_meeting_ids(corpus))

    if args.list_meetings:
        print(f"Found {len(meeting_ids)} meetings:")
        for mid in meeting_ids:
            speakers = _get_speaker_files(corpus, mid)
            print(f"  {mid} ({len(speakers)} speakers)")
        return

    if args.meeting:
        # Convert a single meeting.
        records = convert_meeting(corpus, args.meeting)
        if not records:
            print(f"No data found for meeting {args.meeting}", file=sys.stderr)
            sys.exit(1)

        output = args.output or Path(f"{args.meeting}.json")
        save_jsonl(records, output)

    elif args.convert_all:
        # Convert all meetings.
        output_dir = args.output or Path("meetings")
        for mid in meeting_ids:
            records = convert_meeting(corpus, mid)
            if records:
                save_jsonl(records, output_dir / f"{mid}.json")

        print(f"\nConverted {len(meeting_ids)} meetings to {output_dir}/")

    else:
        parser.print_help()
        print(f"\nAvailable meetings: {len(meeting_ids)}")
        print("Use --meeting ID or --all to convert.")


if __name__ == "__main__":
    main()
