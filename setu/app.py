"""Setu - User-facing product integrating with the TANTRA runtime.

Setu (Sanskrit: bridge/connection) accepts real user requests and routes them
through the complete TANTRA runtime lifecycle:

  User → Setu → Core → Sarathi → Bridge → Execution → Bucket → InsightFlow → User

Every request traverses all runtime participants, producing replay records
and InsightFlow telemetry as proof of the complete lifecycle.
"""

import os
import time
import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Optional

import requests as http_client
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CORE_URL = os.getenv("CORE_URL", "http://localhost:3000")
BUCKET_URL = os.getenv("BUCKET_URL", "http://localhost:3004")
INSIGHTFLOW_URL = os.getenv("INSIGHTFLOW_URL", "http://localhost:3005")
SETU_PORT = int(os.getenv("SETU_PORT", "8000"))
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "15"))

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class ProcessRequest(BaseModel):
    """User request to be processed through the TANTRA runtime."""
    workload: str = Field(
        ...,
        min_length=1,
        max_length=4096,
        description="The task or workload to process through the TANTRA runtime",
    )
    metadata: Optional[dict[str, Any]] = Field(
        default=None,
        description="Optional metadata to attach to the request",
    )


class ProcessResponse(BaseModel):
    """Response returned to the user after TANTRA runtime processing."""
    status: str
    trace_id: str
    execution_id: str
    cet_hash: Optional[str] = None
    result: Optional[dict[str, Any]] = None
    artifact_location: Optional[str] = None
    duration_ms: Optional[int] = None
    runtime_chain: list[str]
    setu_request_id: str
    timestamp: str


class HealthResponse(BaseModel):
    """Health check response."""
    service: str
    status: str
    tantra_runtime: dict[str, Any]
    timestamp: str


class ArtifactResponse(BaseModel):
    """Artifact retrieval response."""
    trace_id: str
    execution_id: str
    result: Any
    timestamp: Optional[str] = None
    hash: Optional[str] = None
    stored_at: Optional[str] = None


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Setu",
    description=(
        "User-facing product bridging real requests to the TANTRA runtime. "
        "Every request traverses: Core → Sarathi → Bridge → Execution → "
        "Bucket → Replay Persistence → InsightFlow."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _setu_request_id() -> str:
    """Generate a unique Setu request identifier."""
    raw = f"setu-{time.time_ns()}-{os.getpid()}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def _check_service(url: str, timeout: float = 2.0) -> dict[str, Any]:
    """Probe a TANTRA service health endpoint."""
    try:
        resp = http_client.get(f"{url}/health", timeout=timeout)
        data = resp.json()
        return {"status": "healthy", "detail": data}
    except Exception as exc:
        return {"status": "unreachable", "error": str(exc)}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check — verifies connectivity to the TANTRA runtime."""
    services = {
        "core": _check_service(CORE_URL),
        "bucket": _check_service(BUCKET_URL),
        "insightflow": _check_service(INSIGHTFLOW_URL),
    }
    all_healthy = all(s["status"] == "healthy" for s in services.values())

    return HealthResponse(
        service="setu",
        status="healthy" if all_healthy else "degraded",
        tantra_runtime=services,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@app.post("/process", response_model=ProcessResponse)
async def process_request(req: ProcessRequest):
    """Process a user request through the complete TANTRA runtime chain.

    Lifecycle:
      1. Setu assigns a setu_request_id and timestamps the request.
      2. Forwards workload to Core (/initiate).
      3. Core generates trace_id + execution_id + cet_hash.
      4. Core requests JWT from Sarathi.
      5. Core forwards to Bridge with JWT.
      6. Bridge validates JWT, enforces ID immutability, forwards to Execution.
      7. Execution runs the workload via execution_participant.
      8. Execution stores artifact in Bucket.
      9. Replay hooks record to append-only store.
     10. InsightFlow receives telemetry events.
     11. Setu returns the full result to the user.
    """
    setu_id = _setu_request_id()
    start = time.monotonic()

    try:
        # Step 1-10: Forward to TANTRA Core which orchestrates the full chain
        core_resp = http_client.post(
            f"{CORE_URL}/initiate",
            json={
                "workload": req.workload,
                "source": "setu",
                "setu_request_id": setu_id,
                "user_metadata": req.metadata or {},
            },
            timeout=REQUEST_TIMEOUT,
        )
        core_data = core_resp.json()

    except http_client.ConnectionError:
        raise HTTPException(
            status_code=503,
            detail="TANTRA Core is unavailable. Ensure all runtime services are running.",
        )
    except http_client.Timeout:
        raise HTTPException(
            status_code=504,
            detail="TANTRA Core request timed out.",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Runtime error: {exc}")

    duration_ms = int((time.monotonic() - start) * 1000)

    if core_resp.status_code >= 400:
        raise HTTPException(
            status_code=core_resp.status_code,
            detail=core_data,
        )

    # Extract chain identifiers from Core response
    trace_id = core_data.get("trace_id", "")
    execution_id = core_data.get("execution_id", "")
    cet_hash = core_data.get("cet_hash")
    result = core_data.get("result", {})
    artifact_location = result.get("artifact_location") if isinstance(result, dict) else None

    return ProcessResponse(
        status="completed",
        trace_id=trace_id,
        execution_id=execution_id,
        cet_hash=cet_hash,
        result=result,
        artifact_location=artifact_location,
        duration_ms=duration_ms,
        runtime_chain=[
            "setu",
            "core",
            "sarathi",
            "bridge",
            "execution",
            "bucket",
            "replay_persistence",
            "insightflow",
        ],
        setu_request_id=setu_id,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@app.get("/artifact/{trace_id}/{execution_id}", response_model=ArtifactResponse)
async def get_artifact(trace_id: str, execution_id: str):
    """Retrieve a previously stored artifact from the Bucket."""
    try:
        resp = http_client.get(
            f"{BUCKET_URL}/retrieve/{trace_id}/{execution_id}",
            timeout=5,
        )
        if resp.status_code == 404:
            raise HTTPException(status_code=404, detail="Artifact not found")
        data = resp.json()
        return ArtifactResponse(**data)
    except http_client.ConnectionError:
        raise HTTPException(status_code=503, detail="Bucket service unavailable")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/telemetry/{trace_id}")
async def get_telemetry(trace_id: str):
    """Retrieve InsightFlow telemetry for a specific trace."""
    try:
        resp = http_client.get(
            f"{INSIGHTFLOW_URL}/telemetry/{trace_id}",
            timeout=5,
        )
        return resp.json()
    except http_client.ConnectionError:
        raise HTTPException(status_code=503, detail="InsightFlow unavailable")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/telemetry")
async def get_telemetry_summary():
    """Get InsightFlow telemetry summary."""
    try:
        resp = http_client.get(
            f"{INSIGHTFLOW_URL}/telemetry/summary",
            timeout=5,
        )
        return resp.json()
    except http_client.ConnectionError:
        raise HTTPException(status_code=503, detail="InsightFlow unavailable")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/")
async def root():
    """Root endpoint — Setu API information."""
    return {
        "name": "Setu",
        "version": "1.0.0",
        "description": "User-facing product bridging requests to the TANTRA runtime",
        "runtime_chain": [
            "User → Setu → Core → Sarathi → Bridge → Execution → Bucket → InsightFlow → User"
        ],
        "endpoints": {
            "process": "POST /process",
            "health": "GET /health",
            "artifact": "GET /artifact/{trace_id}/{execution_id}",
            "telemetry": "GET /telemetry/{trace_id}",
            "telemetry_summary": "GET /telemetry",
        },
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=SETU_PORT)
