# AI Agent - FastAPI Decision Engine

A FastAPI-based AI agent system that uses LLM to make decisions and execute data analysis tasks.

## Features

- **AI Decision Engine**: Uses LLM (OpenAI) to decide actions based on user queries
- **Data Analysis Pipeline**: Analyzes CSV datasets with pandas
- **Request Tracing**: Unique trace_id for each request with structured logging
- **Input Validation**: Validates queries and file uploads
- **Error Handling**: Structured error responses with trace_id

## Tech Stack

- FastAPI - Web framework
- OpenAI - LLM for decision making
- Pandas - Data analysis
- Python 3.8+

## How to Run

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set up environment variables in `.env`:
```
BUCKET_URL=your_bucket_url
LLM_API_KEY=your_llm_key
```

3. Run the server:
```bash
cd app
uvicorn main:app --reload
```

4. Visit `http://localhost:8000/docs` to test the API

## Example Request

**Endpoint**: `POST /analyze`

**Form Data**:
- `query`: "Analyze this dataset"
- `file`: (CSV file upload)

**Response**:
```json
{
  "trace_id": "a1b2c3d4",
  "status": "success",
  "action": {
    "action": "analyze_dataset",
    "reason": "User wants data analysis"
  },
  "result": {
    "rows": 100,
    "columns": 5,
    "column_names": ["col1", "col2", "col3", "col4", "col5"],
    "missing_values": {"col3": 2},
    "summary_statistics": {
      "col1": {"mean": 50.5, "median": 50.0, "min": 0.0, "max": 100.0}
    }
  }
}
```

## Error Response Format

```json
{
  "trace_id": "a1b2c3d4",
  "status": "error",
  "message": "File must be a CSV"
}
```

---

## TANTRA Gated Bridge — Survivability Layer

Replay persistence, reconstruction, observability, and survivability testing for the zero-trust distributed services pipeline.

See [services/README.md](services/README.md) for full documentation.

| Module | Status |
|--------|--------|
| Replay Persistence | Append-only JSONL log with SHA-256 hash chain. 7/7 survivability tests pass. |
| Replay Reconstruction | Trace reconstruction, corruption detection, deterministic verification. |
| Observability | Passive telemetry only. All events tagged `passive: true`. Zero execution authority. |
| Survivability Tests | 7 scenarios: restart, corruption, concurrent validation, failure propagation. |

**Constitutional boundaries**: [CONSTITUTIONAL_REVIEW.md](services/CONSTITUTIONAL_REVIEW.md) · [HIDDEN_STATE_DISCLOSURE.md](services/HIDDEN_STATE_DISCLOSURE.md) · [DRIFT_RISK_ANALYSIS.md](services/DRIFT_RISK_ANALYSIS.md)

**Review packet**: [services/review_packets/REVIEW_PACKET_SURVIVABILITY_V1.md](services/review_packets/REVIEW_PACKET_SURVIVABILITY_V1.md)
