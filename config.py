"""
Configuration for the Synthetix-4.0 backend.

Loads settings from a .env file and provides sensible defaults.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the project root.
_env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(_env_path)


# ── OpenAI ───────────────────────────────────────────────────────────

OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
MODEL_NAME: str = os.getenv("MODEL_NAME", "gpt-4o-mini")
EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")

# ── Anti-hallucination thresholds ────────────────────────────────────

# If the overall confidence score falls below this, return a
# FailsafeResponse instead of potentially hallucinated results.
CONFIDENCE_THRESHOLD: int = int(os.getenv("CONFIDENCE_THRESHOLD", "40"))

# Enable the two-pass verification (extraction → verification).
# Disable to save API costs during development.
ENABLE_VERIFICATION_PASS: bool = os.getenv(
    "ENABLE_VERIFICATION_PASS", "true"
).lower() == "true"

# ── Server ───────────────────────────────────────────────────────────

HOST: str = os.getenv("HOST", "0.0.0.0")
PORT: int = int(os.getenv("PORT", "8000"))
