"""
Pydantic models for the Synthetix-4.0 API.

Defines request/response schemas for the /analyze endpoint,
matching the frontend Analysis Report page layout.
"""

from __future__ import annotations

import uuid
from typing import List, Optional

from pydantic import BaseModel, Field


# ── Response sub-models ──────────────────────────────────────────────


class Decision(BaseModel):
    """A key decision made during the meeting."""
    id: int
    title: str
    description: str  # includes [cite: N] references


class RiskOrQuestion(BaseModel):
    """A risk, concern, or open question raised in the meeting."""
    id: int
    title: str
    description: str  # includes [cite: N] references


class ActionItem(BaseModel):
    """A concrete action item with ownership and deadline."""
    id: int
    task: str
    owner: str = "Unassigned"
    due_date: Optional[str] = None
    evidence: str = ""  # quote from transcript with [cite: N]


class Metadata(BaseModel):
    """Processing metadata for the analysis."""
    model: str = "gpt-4o-mini"
    total_duration_sec: float = 0.0
    total_duration_human: str = "0s"
    speakers_detected: List[str] = Field(default_factory=list)
    processing_time_sec: float = 0.0
    segment_count: int = 0
    warnings: List[str] = Field(default_factory=list)


# ── Failsafe response ───────────────────────────────────────────────


class FailsafeResponse(BaseModel):
    """
    Returned when the LLM cannot confidently extract information.
    Instead of making up answers, the system gracefully reports
    what went wrong and what it couldn't determine.
    """
    meeting_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    success: bool = False
    confidence_score: int = 0
    confidence_label: str = "Insufficient confidence — analysis may be unreliable"
    message: str = (
        "The system could not extract reliable information from this transcript. "
        "This may be because the transcript is too short, lacks clear meeting "
        "structure, or contains insufficient dialogue for meaningful analysis."
    )
    issues: List[str] = Field(default_factory=list)
    focus_topic_found: Optional[bool] = None
    metadata: Metadata = Field(default_factory=Metadata)


# ── Main response ───────────────────────────────────────────────────


class AnalyzeResponse(BaseModel):
    """
    Full analysis response matching the Analysis Report page.

    Every text field that references the transcript includes
    [cite: N] markers pointing to segment numbers.
    """
    meeting_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    success: bool = True
    confidence_score: int = Field(ge=0, le=100)
    confidence_label: str = "High confidence in transcript analysis accuracy"
    meeting_summary: List[str] = Field(default_factory=list)
    key_decisions: List[Decision] = Field(default_factory=list)
    risks_and_open_questions: List[RiskOrQuestion] = Field(default_factory=list)
    action_items: List[ActionItem] = Field(default_factory=list)
    focus_topic_found: Optional[bool] = None
    metadata: Metadata = Field(default_factory=Metadata)


# ── Internal models (not sent to frontend) ───────────────────────────


class Segment(BaseModel):
    """A single timestamped segment from the transcript."""
    id: int
    start_time: float  # seconds
    end_time: float
    start_time_human: str  # "00:01:34"
    text: str
    audio_filepath: str = ""


class Meeting(BaseModel):
    """Internal representation of a loaded meeting transcript."""
    segments: List[Segment]
    total_duration_sec: float
    total_duration_human: str
    raw_transcript: str  # numbered transcript string for LLM
    attendees: List[str] = Field(default_factory=list)
    meeting_date: Optional[str] = None
