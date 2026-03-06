import re
import json
import hashlib
import logging
import argparse
from pathlib import Path

logger = logging.getLogger(__name__)


def parse_transcript_to_json(
    file_path: str | Path,
    output_path: str | Path | None = None,
    known_speakers: list[str] | None = None,
) -> dict:
    """
    Converts a .txt transcript into a structured JSON list.

    Handles multi-line dialogue by accumulating text until the next speaker
    line is encountered. Skipped/malformed lines are tracked and returned
    alongside the parsed entries.

    Args:
        file_path:       Path to the input .txt transcript.
        output_path:     Optional path to write the resulting JSON file.
        known_speakers:  Optional list of expected speaker names.
                         When provided, only these names are accepted as
                         valid speakers, which avoids false matches on
                         lines that happen to contain colons.

    Returns:
        A dict with two keys:
            "entries"  – list of parsed utterance dicts
            "skipped"  – list of dicts describing lines that were skipped
    """
    file_path = Path(file_path)
    if not file_path.exists():
        raise FileNotFoundError(f"Transcript file not found: {file_path}")

    # Regex: Speaker Name (no colons) followed by colon and optional text.
    # Supports names with spaces/numbers like 'Project Manager' or 'Speaker 1'.
    pattern = re.compile(r"^([^:]+):\s*(.*)$")

    # Normalise the known-speaker list for case-insensitive comparison.
    speaker_set: set[str] | None = None
    if known_speakers:
        speaker_set = {s.strip().lower() for s in known_speakers}

    structured_data: list[dict] = []
    skipped_lines: list[dict] = []
    # State for accumulating multi-line dialogue.
    current_speaker: str | None = None
    current_text_parts: list[str] = []
    current_start_line: int = 0

    def _flush_entry() -> None:
        """Flush the accumulated speaker/text into structured_data."""
        nonlocal current_speaker, current_text_parts, current_start_line
        if current_speaker is None:
            return

        full_text = " ".join(current_text_parts).strip()
        # Build a deterministic ID from content so re-runs produce the same output.
        unique_hash = hashlib.md5(
            f"{current_start_line}:{current_speaker}:{full_text}".encode()
        ).hexdigest()[:8]

        entry = {
            "id": f"line_{current_start_line}_{unique_hash}",
            "speaker": current_speaker,
            "text": full_text,
            "metadata": {
                "start_line": current_start_line,
                "is_valid": True,
            },
        }
        structured_data.append(entry)

        # Reset state.
        current_speaker = None
        current_text_parts = []
        current_start_line = 0

    with open(file_path, "r", encoding="utf-8") as f:
        for line_num, raw_line in enumerate(f, 1):
            line = raw_line.strip()
            if not line:
                continue

            match = pattern.match(line)

            if match:
                candidate_speaker, text = match.groups()
                candidate_speaker = candidate_speaker.strip()

                # If a known-speaker list is provided, validate against it.
                if speaker_set and candidate_speaker.lower() not in speaker_set:
                    # Not a real speaker line — treat as continuation text.
                    if current_speaker is not None:
                        current_text_parts.append(line)
                    else:
                        logger.warning(
                            "Skipping unrecognised line %d: %s", line_num, line
                        )
                        skipped_lines.append(
                            {"line_number": line_num, "content": line,
                             "reason": "unrecognised speaker"}
                        )
                    continue

                # New speaker detected — flush the previous entry first.
                _flush_entry()
                current_speaker = candidate_speaker
                current_text_parts = [text.strip()] if text.strip() else []
                current_start_line = line_num

            else:
                # No speaker pattern — could be a multi-line continuation.
                if current_speaker is not None:
                    current_text_parts.append(line)
                else:
                    logger.warning(
                        "Skipping malformed line %d: %s", line_num, line
                    )
                    skipped_lines.append(
                        {"line_number": line_num, "content": line,
                         "reason": "no speaker context"}
                    )

    # Flush the last accumulated entry.
    _flush_entry()

    result = {"entries": structured_data, "skipped": skipped_lines}

    if skipped_lines:
        logger.info(
            "Parsed %d entries, skipped %d lines.",
            len(structured_data),
            len(skipped_lines),
        )
    else:
        logger.info("Parsed %d entries with no skipped lines.", len(structured_data))

    # Optionally write the output to a JSON file.
    if output_path:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as out:
            json.dump(result, out, indent=2, ensure_ascii=False)
        logger.info("JSON written to %s", output_path)

    return result


# ---------------------------------------------------------------------------
# CLI entry-point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)s: %(message)s",
    )

    parser = argparse.ArgumentParser(
        description="Convert a Speaker:Text transcript (.txt) to structured JSON."
    )
    parser.add_argument("input", help="Path to the input .txt transcript file.")
    parser.add_argument(
        "-o", "--output",
        help="Path to write the output .json file. "
             "If omitted, JSON is printed to stdout.",
    )
    parser.add_argument(
        "-s", "--speakers",
        nargs="+",
        help="Optional list of known speaker names to reduce false matches.",
    )
    args = parser.parse_args()

    result = parse_transcript_to_json(
        args.input,
        output_path=args.output,
        known_speakers=args.speakers,
    )

    if not args.output:
        print(json.dumps(result, indent=2, ensure_ascii=False))