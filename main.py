"""
FreshRoute OS - Root Entry Point
Universal wrapper supporting direct execution and auto-detection on Render, Heroku, Railway, etc.
"""

import os
import sys
from pathlib import Path

# Ensure repo root and backend directory are both in sys.path
_REPO_ROOT = Path(__file__).resolve().parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from backend.main import app  # noqa: E402

__all__ = ["app"]

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, log_level="info")
