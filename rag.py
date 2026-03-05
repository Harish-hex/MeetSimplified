"""
RAG engine for "Ask the Meeting" chat.

Embeds transcript segments, stores them in memory, and answers
user questions using retrieval-augmented generation with strict
anti-hallucination rules.
"""

from __future__ import annotations

import json
import logging
import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from openai import OpenAI

import config

logger = logging.getLogger(__name__)

# ── Types ────────────────────────────────────────────────────────────


@dataclass
class SegmentVector:
    """A transcript segment with its embedding."""
    segment_id: int
    speaker: str
    text: str
    start: float
    end: float
    embedding: List[float] = field(default_factory=list, repr=False)


@dataclass
class ChatSource:
    """A source segment returned with a chat answer."""
    segment_id: int
    speaker: str
    text: str
    similarity: float


@dataclass
class ChatResponse:
    """Response from the RAG chat."""
    answer: str
    sources: List[ChatSource]
    confidence: str
    meeting_id: str


# ── In-memory store ──────────────────────────────────────────────────

# Keyed by meeting_id → list of SegmentVectors
_index: Dict[str, List[SegmentVector]] = {}


def is_indexed(meeting_id: str) -> bool:
    return meeting_id in _index


def get_indexed_meetings() -> List[str]:
    return list(_index.keys())


def get_full_transcript(meeting_id: str) -> str:
    """Reconstructs the full transcript text from the indexed segments."""
    if meeting_id not in _index:
        raise ValueError(f"Meeting {meeting_id} is not indexed.")
    
    lines = []
    for seg in sorted(_index[meeting_id], key=lambda s: s.segment_id):
        lines.append(f"[segment {seg.segment_id}] {seg.speaker}: {seg.text}")
    return "\n".join(lines)


# ── OpenAI client (shared with analyze.py) ───────────────────────────

_client: Optional[OpenAI] = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        if not config.OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY is not set.")
        _client = OpenAI(api_key=config.OPENAI_API_KEY)
    return _client


# ── Embedding ────────────────────────────────────────────────────────


def _embed_texts(texts: List[str]) -> List[List[float]]:
    """Embed a batch of texts using OpenAI embeddings."""
    client = _get_client()
    response = client.embeddings.create(
        model=config.EMBEDDING_MODEL,
        input=texts,
    )
    return [item.embedding for item in response.data]


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    """Compute cosine similarity between two vectors."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


# ── Index a meeting ──────────────────────────────────────────────────


def index_meeting(meeting_id: str, segments: list) -> int:
    """
    Embed all segments of a meeting and store in memory.

    Args:
        meeting_id: Unique meeting identifier.
        segments: List of dicts with keys: segment_id, speaker, text, start, end.

    Returns:
        Number of segments indexed.
    """
    if meeting_id in _index:
        logger.info("Meeting %s already indexed (%d segments)", meeting_id, len(_index[meeting_id]))
        return len(_index[meeting_id])

    # Build text representations for embedding
    texts = []
    seg_data = []
    for seg in segments:
        speaker = seg.get("speaker", "Unknown")
        text = seg.get("text", "").strip()
        if not text:
            continue
        # Embed with speaker context for better retrieval
        texts.append(f"{speaker}: {text}")
        seg_data.append(SegmentVector(
            segment_id=seg.get("segment_id", 0),
            speaker=speaker,
            text=text,
            start=seg.get("start", 0.0),
            end=seg.get("end", 0.0),
        ))

    if not texts:
        return 0

    # Batch embed (OpenAI handles up to 2048 inputs)
    logger.info("Embedding %d segments for meeting %s", len(texts), meeting_id)
    BATCH_SIZE = 500
    all_embeddings = []
    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i:i + BATCH_SIZE]
        all_embeddings.extend(_embed_texts(batch))

    for seg, emb in zip(seg_data, all_embeddings):
        seg.embedding = emb

    _index[meeting_id] = seg_data
    logger.info("Indexed %d segments for meeting %s", len(seg_data), meeting_id)
    return len(seg_data)


# ── Search ───────────────────────────────────────────────────────────


def search(meeting_id: str, question: str, top_k: int = 8) -> List[ChatSource]:
    """
    Retrieve the most relevant segments for a question.
    """
    if meeting_id not in _index:
        raise ValueError(f"Meeting {meeting_id} is not indexed.")

    # Embed the question
    q_embedding = _embed_texts([question])[0]

    # Score all segments
    scored = []
    for seg in _index[meeting_id]:
        sim = _cosine_similarity(q_embedding, seg.embedding)
        scored.append((sim, seg))

    # Sort by similarity (descending) and take top-K
    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:top_k]

    return [
        ChatSource(
            segment_id=seg.segment_id,
            speaker=seg.speaker,
            text=seg.text,
            similarity=round(sim, 4),
        )
        for sim, seg in top
    ]


# ── Answer ───────────────────────────────────────────────────────────

CHAT_SYSTEM_PROMPT = """\
You are a meeting Q&A assistant. You answer questions about a meeting \
based ONLY on the provided transcript segments.

STRICT RULES:
1. ONLY use information from the provided segments. Do NOT use outside knowledge.
2. Every factual claim MUST cite the segment number using [segment N] format.
3. If the provided segments do NOT contain enough information to answer the \
   question, respond EXACTLY with: "I couldn't find information about that \
   in this meeting's transcript."
4. Do NOT speculate, infer, or make assumptions beyond what is stated.
5. If the answer is partially available, provide what you can and clearly \
   state what information is missing.
6. Keep answers concise and direct.

Return JSON with this structure:
{
  "answer": "<your answer with [segment N] citations>",
  "confidence": "<'high' if directly stated, 'medium' if implied, 'low' if uncertain>"
}
"""


def answer_question(meeting_id: str, question: str, top_k: int = 8) -> ChatResponse:
    """
    Full RAG pipeline: retrieve relevant segments → answer with citations.
    """
    # Retrieve
    sources = search(meeting_id, question, top_k=top_k)

    # Build context from retrieved segments
    context_lines = []
    for src in sources:
        context_lines.append(
            f"[segment {src.segment_id}] {src.speaker}: {src.text}"
        )
    context = "\n".join(context_lines)

    # Build the prompt
    user_content = (
        f"RETRIEVED TRANSCRIPT SEGMENTS:\n{context}\n\n"
        f"QUESTION: {question}"
    )

    # Call LLM
    client = _get_client()
    response = client.chat.completions.create(
        model=config.MODEL_NAME,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": CHAT_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        temperature=0.1,
    )

    text = response.choices[0].message.content or "{}"
    result = json.loads(text)

    return ChatResponse(
        answer=result.get("answer", "I couldn't process that question."),
        sources=sources,
        confidence=result.get("confidence", "unknown"),
        meeting_id=meeting_id,
    )
