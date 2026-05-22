# TANTRA Gated Bridge — Services

## Architecture

```
Core (:3000) → Sarathi (:3001) → Bridge (:3002) → Execution (:3003) → Bucket (:3004)
```

Zero-trust, hard-fail pipeline. Each service has a single responsibility. No fallback paths.

## Survivability + Observability Layer

### Replay Persistence (`replay_persistence/`)
Append-only replay log with SHA-256 hash chain integrity.

| Module | Purpose |
|--------|---------|
| `append_only_store.js` | Core append-only JSONL log. `appendRecord()` writes, `validateChainIntegrity()` verifies. |
| `lineage_tracker.js` | Builds execution lineage graphs from parent_execution_id references. |
| `continuity_recorder.js` | Records execution transitions, rejections, dependency failures. |
| `idempotency_store.js` | Distributed-safe idempotency. Cache auto-warms from log on restart. |

### Replay Reconstruction (`replay_reconstruction/`)
Read-only trace reconstruction, verification, and corruption detection.

| Module | Purpose |
|--------|---------|
| `reconstruction_tool.js` | Reconstruct traces by trace_id or time range. CLI: `node reconstruction_tool.js <trace_id>` |
| `verification_flow.js` | Full verification pipeline: chain integrity, corruption scan, continuity, deterministic replay. |
| `corruption_detector.js` | Hash chain, orphan, duplicate detection with severity classification. |
| `lineage_graph.js` | Full lineage graph across all traces. Path finding, depth analysis. |
| `demo_reconstruction.js` | Self-contained reconstruction demo. |

### Observability (`observability/`)
Passive telemetry only. Zero execution authority. All events tagged `passive: true`.

| Module | Purpose |
|--------|---------|
| `telemetry_emitter.js` | Execution transitions, rejections, dependency failures, verification outcomes. |
| `trace_collector.js` | Distributed trace span emission (`trace:` prefixed events). |
| `replay_hooks.js` | Visibility hooks for bridge integration (must be called explicitly). |

### Survivability Tests (`survivability_tests/`)
7 scenarios proving replay persistence and recovery.

| ID | Scenario | Critical |
|----|----------|----------|
| SURV-001 | Bridge restart during execution | Yes |
| SURV-002 | Bucket restart during replay verification | Yes |
| SURV-003 | Replay reconstruction after restart | Yes |
| SURV-004 | Corrupted lineage isolation | Yes |
| SURV-005 | Concurrent replay-chain validation | No |
| SURV-006 | Service unavailability propagation | Yes |
| SURV-007 | Trace continuity under degraded conditions | No |

## Quick Start

```bash
# Run survivability proof (PowerShell)
cd survivability_tests
powershell -File run_proof.ps1

# Run survivability proof (Bash)
cd survivability_tests
./run_proof.sh

# Reconstruct a specific trace
cd replay_reconstruction
node reconstruction_tool.js <trace_id>

# Run full verification
cd replay_reconstruction
node verification_flow.js <trace_id>

# Run reconstruction demo
cd replay_reconstruction
node demo_reconstruction.js
```

## Constitutional Boundaries

- Replay persistence is append-only — zero HTTP, zero execution logic
- Observability is passive — all events tagged `passive: true`
- Reconstruction is read-only — zero file modification
- No module can create/modify JWTs, execution state, or routing decisions

See [CONSTITUTIONAL_REVIEW.md](CONSTITUTIONAL_REVIEW.md), [HIDDEN_STATE_DISCLOSURE.md](HIDDEN_STATE_DISCLOSURE.md), [DRIFT_RISK_ANALYSIS.md](DRIFT_RISK_ANALYSIS.md).
