"""
Synthetix-4.0 — FastAPI Backend

Provides the API that the frontend calls to analyze meeting transcripts.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import List, Optional, Union

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import config
import rag
from analyze import analyze_meeting
from ami_to_json import _get_meeting_ids, _get_speaker_files, convert_meeting
from ingest import load_transcript
from models import AnalyzeResponse, FailsafeResponse

# Path to the AMI corpus (relative to working directory)
AMI_CORPUS_DIR = Path("ami_public_manual_1.6.2")

# ── Logging ──────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)

# ── App ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="Synthetix-4.0",
    description="AI-powered meeting transcript analyzer",
    version="0.1.0",
)

# Allow the frontend (running on a different port/origin) to call us.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Endpoints ────────────────────────────────────────────────────────


@app.get("/health")
async def health():
    """Health check for the frontend to verify the backend is up."""
    return {
        "status": "ok",
        "model": config.MODEL_NAME,
        "verification_enabled": config.ENABLE_VERIFICATION_PASS,
    }


@app.post("/analyze")
async def analyze(
    file: UploadFile = File(..., description="Transcript file (.txt or .json)"),
    meeting_date: Optional[str] = Form(None, description="Optional meeting date"),
    attendees: Optional[str] = Form(None, description="Comma-separated attendee names"),
    focus_topic: Optional[str] = Form(None, description="Optional focus topic to filter analysis"),
) -> Union[AnalyzeResponse, FailsafeResponse]:
    """
    Analyze a meeting transcript and return structured insights.

    - Accepts .txt or .json (JSONL) files.
    - Returns an AnalyzeResponse with summary, decisions, risks, action items.
    - If confidence is too low, returns a FailsafeResponse instead of
      potentially hallucinated results.
    """
    # ── Validate the upload ──────────────────────────────────────
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded.")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ("txt", "json"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '.{ext}'. Upload a .txt or .json file.",
        )

    # ── Read file bytes ──────────────────────────────────────────
    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read file: {e}")

    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # ── Parse attendees ──────────────────────────────────────────
    attendee_list: List[str] = []
    if attendees:
        attendee_list = [a.strip() for a in attendees.split(",") if a.strip()]

    # ── Ingest ───────────────────────────────────────────────────
    try:
        meeting = load_transcript(
            file_bytes=file_bytes,
            filename=file.filename,
            meeting_date=meeting_date,
            attendees=attendee_list,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Ingestion error: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse transcript: {e}",
        )

    # ── Analyze ──────────────────────────────────────────────────
    logger.info(
        "Analyzing %d segments (%.1fs total) with model %s",
        len(meeting.segments),
        meeting.total_duration_sec,
        config.MODEL_NAME,
    )

    try:
        result = analyze_meeting(meeting, focus_topic=focus_topic)
    except RuntimeError as e:
        # e.g., missing API key
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error("Analysis error: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed unexpectedly: {e}",
        )

    return result


@app.get("/meetings")
async def list_meetings():
    """List all available AMI meetings from the corpus on disk."""
    if not AMI_CORPUS_DIR.exists():
        raise HTTPException(
            status_code=404,
            detail=f"AMI corpus not found at '{AMI_CORPUS_DIR}'. Ensure the corpus directory exists.",
        )

    meeting_ids = sorted(_get_meeting_ids(AMI_CORPUS_DIR))
    meetings = []
    for mid in meeting_ids:
        speakers = _get_speaker_files(AMI_CORPUS_DIR, mid)
        meetings.append({
            "id": mid,
            "speakers": len(speakers),
        })

    return {"meetings": meetings, "count": len(meetings)}


@app.post("/analyze/meeting/{meeting_id}")
async def analyze_ami_meeting(
    meeting_id: str,
    background_tasks: BackgroundTasks,
    meeting_date: Optional[str] = Form(None),
    attendees: Optional[str] = Form(None),
    focus_topic: Optional[str] = Form(None),
) -> Union[AnalyzeResponse, FailsafeResponse]:
    """
    Convert an AMI corpus meeting from XML and analyze it in one step.
    No file upload needed — just provide the meeting ID (e.g., ES2002a).
    """
    if not AMI_CORPUS_DIR.exists():
        raise HTTPException(
            status_code=404,
            detail=f"AMI corpus not found at '{AMI_CORPUS_DIR}'.",
        )

    # Convert AMI XML → JSONL records in memory
    records = convert_meeting(AMI_CORPUS_DIR, meeting_id)
    if not records:
        raise HTTPException(
            status_code=404,
            detail=f"Meeting '{meeting_id}' not found in AMI corpus.",
        )

    # Convert to JSONL bytes (same format as our .json files)
    jsonl_bytes = "\n".join(json.dumps(r, ensure_ascii=False) for r in records).encode("utf-8")

    # Parse attendees
    attendee_list: List[str] = []
    if attendees:
        attendee_list = [a.strip() for a in attendees.split(",") if a.strip()]

    # Ingest
    try:
        meeting = load_transcript(
            file_bytes=jsonl_bytes,
            filename=f"{meeting_id}.json",
            meeting_date=meeting_date,
            attendees=attendee_list,
        )
    except Exception as e:
        logger.error("Ingestion error for AMI meeting %s: %s", meeting_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to process meeting: {e}")

    # Analyze
    logger.info(
        "Analyzing AMI meeting %s: %d segments (%.1fs total) with model %s",
        meeting_id,
        len(meeting.segments),
        meeting.total_duration_sec,
        config.MODEL_NAME,
    )

    try:
        result = analyze_meeting(meeting, focus_topic=focus_topic)
        result.meeting_id = meeting_id  # Force the ID to match the route param
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error("Analysis error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Analysis failed unexpectedly: {e}")

    # Index for RAG in the background
    if isinstance(result, AnalyzeResponse) or result.success:
        segments_for_rag = [
            {
                "segment_id": s.id,
                "text": s.text,
                "start": s.start_time,
                "end": s.end_time,
            }
            for s in meeting.segments
        ]
        background_tasks.add_task(rag.index_meeting, result.meeting_id, segments_for_rag)

    return result


class ChatRequest(BaseModel):
    question: str


@app.post("/chat/{meeting_id}")
async def chat_with_meeting(meeting_id: str, req: ChatRequest):
    """Ask a question about an analyzed meeting using RAG."""
    if not rag.is_indexed(meeting_id):
        raise HTTPException(
            status_code=400,
            detail="Meeting is not yet indexed or analysis is still finishing."
        )

    try:
        response = rag.answer_question(meeting_id, req.question)
        return response
    except Exception as e:
        logger.error("Chat error for %s: %s", meeting_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Chat failed: {e}")


# ── Run with: python3 main.py ────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=config.HOST,
        port=config.PORT,
        reload=True,
    )
