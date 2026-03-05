"""
LLM analysis layer for Synthetix-4.0.

Two-pass anti-hallucination pipeline:
  Pass 1 — Extraction:   LLM extracts structured data with [cite: N] references.
  Pass 2 — Verification: LLM verifies each extraction against the transcript.

If overall confidence drops below the threshold, returns a FailsafeResponse
instead of potentially hallucinated results.
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from typing import List, Optional, Union

from openai import OpenAI

import config
from models import (
    ActionItem,
    AnalyzeResponse,
    Decision,
    FailsafeResponse,
    Meeting,
    Metadata,
    RiskOrQuestion,
)

logger = logging.getLogger(__name__)

# ── OpenAI client ────────────────────────────────────────────────────

_client: Optional[OpenAI] = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        if not config.OPENAI_API_KEY:
            raise RuntimeError(
                "OPENAI_API_KEY is not set. "
                "Copy .env.example to .env and fill in your key."
            )
        _client = OpenAI(api_key=config.OPENAI_API_KEY)
    return _client


# ── Prompts ──────────────────────────────────────────────────────────

EXTRACTION_SYSTEM_PROMPT = """\
You are an expert meeting analyst. You will receive a timestamped meeting \
transcript where each segment is numbered like [1], [2], etc.

Your task is to extract structured information and return ONLY valid JSON.

CRITICAL RULES:
- Every claim MUST reference specific segment numbers using [cite: N] format.
- If you cannot find evidence for something, DO NOT make it up.
- If the transcript is too vague or short to extract meaningful information, \
  set confidence_score to a low number and explain in confidence_label.

EXTRACTION GUIDELINES:
- **Decisions**: List EACH decision as a SEPARATE entry. If three things were \
  decided (e.g., price, target market, and cost cap), that is THREE separate \
  decisions, not one combined entry. Look for agreement phrases like \
  "we'll go with", "that's decided", "let's do", price/budget figures, \
  scope choices, and strategic direction choices.
- **Action items**: List EACH person's assignment as a SEPARATE entry. If \
  three people are each assigned tasks (even in the same sentence), that is \
  THREE separate action items. Look for phrases like "will work on", \
  "is responsible for", "needs to", "should prepare", "take care of". \
  Only extract items that are EXPLICITLY stated — do not infer or guess \
  owners or due dates unless clearly stated.
- **Risks & open questions**: Include unresolved questions, scope ambiguities, \
  concerns raised but not settled, and any "what about..." or "whether..." \
  discussions that did not reach a conclusion.
- **Speakers**: Identify them from dialogue cues (e.g., "said X", \
  "Speaker A:"). If no speakers are identifiable, return an empty list.
- **Summary**: Cover ALL major topics discussed, not just the first few.

Return JSON with this exact structure:
{
  "confidence_score": <0-100 integer>,
  "confidence_label": "<one-line explanation of confidence level>",
  "meeting_summary": ["<bullet point with [cite: N]>", ...],
  "speakers_detected": ["<name or Speaker A>", ...],
  "key_decisions": [
    {"id": 1, "title": "<short title>", "description": "<detail with [cite: N]>"}
  ],
  "risks_and_open_questions": [
    {"id": 1, "title": "<short title>", "description": "<detail with [cite: N]>"}
  ],
  "action_items": [
    {
      "id": 1,
      "task": "<what needs to be done [cite: N]>",
      "owner": "<who is responsible, or 'Unassigned'>",
      "due_date": "<YYYY-MM-DD or null>",
      "evidence": "<exact quote from transcript [cite: N]>"
    }
  ]
}

If the transcript does not contain enough meaningful meeting content \
(e.g., it's a story, random text, or too short), set confidence_score \
below 30 and explain why in confidence_label.
"""

VERIFICATION_SYSTEM_PROMPT = """\
You are a fact-checker. You will receive:
1. A meeting transcript (numbered segments).
2. An analysis extracted from that transcript.

Your job is to verify EVERY claim in the analysis against the transcript.

For each item (summary bullet, decision, question, action item):
- Check if the [cite: N] reference actually supports the claim.
- Mark as "CONFIRMED" if the transcript clearly supports it.
- Mark as "UNCONFIRMED" if the evidence is weak or the citation is wrong.
- Mark as "FABRICATED" if the claim has no basis in the transcript at all.

Return JSON with this structure:
{
  "verified_count": <number of CONFIRMED items>,
  "total_count": <total number of items checked>,
  "adjusted_confidence": <0-100 integer>,
  "issues": ["<description of any problems found>", ...],
  "fabricated_items": ["<description of fabricated claims>", ...]
}
"""


# ── LLM Calls ────────────────────────────────────────────────────────


def _call_llm(system_prompt: str, user_content: str) -> dict:
    """Make a single LLM call and parse the JSON response."""
    client = _get_client()

    response = client.chat.completions.create(
        model=config.MODEL_NAME,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        temperature=0.1,  # Low temperature for factual extraction
    )

    text = response.choices[0].message.content or "{}"
    return json.loads(text)


# ── Pass 1: Extraction ───────────────────────────────────────────────


def _extract(meeting: Meeting) -> dict:
    """Run the LLM extraction pass on the transcript."""
    context_parts: List[str] = []

    if meeting.meeting_date:
        context_parts.append(f"Meeting Date: {meeting.meeting_date}")
    if meeting.attendees:
        context_parts.append(f"Known Attendees: {', '.join(meeting.attendees)}")

    context_parts.append(
        f"Total Duration: {meeting.total_duration_human} "
        f"({len(meeting.segments)} segments)"
    )
    context_parts.append(f"\nTRANSCRIPT:\n{meeting.raw_transcript}")

    user_content = "\n".join(context_parts)
    logger.info("Pass 1 — Extraction: sending %d chars to LLM", len(user_content))

    return _call_llm(EXTRACTION_SYSTEM_PROMPT, user_content)


# ── Pass 2: Verification ─────────────────────────────────────────────


def _verify(meeting: Meeting, extraction: dict) -> dict:
    """Run the verification pass to catch hallucinations."""
    user_content = (
        f"TRANSCRIPT:\n{meeting.raw_transcript}\n\n"
        f"ANALYSIS TO VERIFY:\n{json.dumps(extraction, indent=2)}"
    )
    logger.info("Pass 2 — Verification: sending %d chars to LLM", len(user_content))

    return _call_llm(VERIFICATION_SYSTEM_PROMPT, user_content)


# ── Main Pipeline ────────────────────────────────────────────────────


def analyze_meeting(meeting: Meeting) -> Union[AnalyzeResponse, FailsafeResponse]:
    """
    Run the full two-pass analysis pipeline.

    Returns AnalyzeResponse on success, or FailsafeResponse if
    confidence is too low (graceful failure instead of hallucination).
    """
    start = time.time()
    warnings: List[str] = []

    # ── Pass 1: Extraction ───────────────────────────────────────
    try:
        extraction = _extract(meeting)
    except Exception as e:
        logger.error("Extraction failed: %s", e)
        return FailsafeResponse(
            message=f"LLM extraction failed: {e}",
            issues=[str(e)],
            metadata=Metadata(
                model=config.MODEL_NAME,
                total_duration_sec=meeting.total_duration_sec,
                total_duration_human=meeting.total_duration_human,
                segment_count=len(meeting.segments),
                processing_time_sec=round(time.time() - start, 2),
            ),
        )

    confidence = int(extraction.get("confidence_score", 0))
    confidence_label = extraction.get(
        "confidence_label", "Confidence level not reported"
    )

    # ── Pass 2: Verification (optional) ──────────────────────────
    if config.ENABLE_VERIFICATION_PASS:
        try:
            verification = _verify(meeting, extraction)
            adjusted = int(verification.get("adjusted_confidence", confidence))
            # Use the lower of the two scores for safety.
            confidence = min(confidence, adjusted)
            issues = verification.get("issues", [])
            fabricated = verification.get("fabricated_items", [])

            if fabricated:
                warnings.append(
                    f"Verification found {len(fabricated)} potentially "
                    f"fabricated claim(s) — these have been flagged."
                )
                for fab in fabricated:
                    warnings.append(f"⚠️ Fabricated: {fab}")

            if issues:
                warnings.extend(issues)

            if adjusted < confidence:
                confidence_label = (
                    f"Confidence reduced after verification: {confidence}%"
                )

        except Exception as e:
            logger.warning("Verification pass failed: %s", e)
            warnings.append(f"Verification pass could not complete: {e}")

    # ── Failsafe check ───────────────────────────────────────────
    elapsed = round(time.time() - start, 2)

    if confidence < config.CONFIDENCE_THRESHOLD:
        logger.warning(
            "Confidence %d%% is below threshold %d%% — returning failsafe",
            confidence,
            config.CONFIDENCE_THRESHOLD,
        )
        return FailsafeResponse(
            confidence_score=confidence,
            confidence_label=confidence_label,
            message=(
                f"The analysis confidence ({confidence}%) is below the "
                f"minimum threshold ({config.CONFIDENCE_THRESHOLD}%). "
                "The system cannot provide reliable results for this "
                "transcript. This may be because the content lacks clear "
                "meeting structure, speaker identification, or actionable "
                "discussion."
            ),
            issues=warnings
            or ["Transcript content did not yield confident extractions."],
            metadata=Metadata(
                model=config.MODEL_NAME,
                total_duration_sec=meeting.total_duration_sec,
                total_duration_human=meeting.total_duration_human,
                speakers_detected=extraction.get("speakers_detected", []),
                processing_time_sec=elapsed,
                segment_count=len(meeting.segments),
                warnings=warnings,
            ),
        )

    # ── Build successful response ────────────────────────────────
    speakers = extraction.get("speakers_detected", [])
    if not speakers and meeting.attendees:
        speakers = meeting.attendees
        warnings.append(
            "Speaker detection could not identify speakers from dialogue — "
            "using provided attendee list instead."
        )

    # Parse decisions
    decisions: List[Decision] = []
    for d in extraction.get("key_decisions", []):
        decisions.append(Decision(
            id=d.get("id", len(decisions) + 1),
            title=d.get("title", "Untitled"),
            description=d.get("description", ""),
        ))

    # Parse risks/questions
    risks: List[RiskOrQuestion] = []
    for r in extraction.get("risks_and_open_questions", []):
        risks.append(RiskOrQuestion(
            id=r.get("id", len(risks) + 1),
            title=r.get("title", "Untitled"),
            description=r.get("description", ""),
        ))

    # Parse action items
    actions: List[ActionItem] = []
    for a in extraction.get("action_items", []):
        actions.append(ActionItem(
            id=a.get("id", len(actions) + 1),
            task=a.get("task", ""),
            owner=a.get("owner", "Unassigned"),
            due_date=a.get("due_date"),
            evidence=a.get("evidence", ""),
        ))

    return AnalyzeResponse(
        confidence_score=confidence,
        confidence_label=confidence_label,
        meeting_summary=extraction.get("meeting_summary", []),
        key_decisions=decisions,
        risks_and_open_questions=risks,
        action_items=actions,
        metadata=Metadata(
            model=config.MODEL_NAME,
            total_duration_sec=meeting.total_duration_sec,
            total_duration_human=meeting.total_duration_human,
            speakers_detected=speakers,
            processing_time_sec=elapsed,
            segment_count=len(meeting.segments),
            warnings=warnings,
        ),
    )
