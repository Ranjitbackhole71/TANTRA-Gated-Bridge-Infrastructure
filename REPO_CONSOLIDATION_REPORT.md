# Repository Consolidation Report

## Problem

Two parallel directory trees existed with different file versions:

| Directory | Status |
|---|---|
| `services/` | Canonical (more complete, EdDSA+RS256+JWKS) |
| `tantra_gated_bridge/services/` | Stale (older, RS256-only, no JWKS) |

## Action Taken

1. **Source of Truth**: `services/` declared canonical
2. **Sync Direction**: `services/` → `tantra_gated_bridge/services/`
3. **Unique Files Preserved**: Files only in `tantra_gated_bridge/services/` were copied to `services/`

## Files Migrated (services/ → tantra_gated_bridge/services/)

### Service Files (Critical)

| File | Size | Status |
|---|---|---|
| `bridge/app.js` | 10330 bytes (was 6168) | Updated with JWKS, EdDSA, cet_hash, continuity |
| `bridge/tests/convergence_test.js` | 21537 bytes (was absent) | Added convergence test suite |
| `bridge/tests/CONVERGENCE_READINESS.md` | 5690 bytes (was absent) | Added readiness doc |
| `execution/app.js` | 7899 bytes (was 6257) | Updated with JWKS, EdDSA, replay hooks |
| `execution/execution_participant.js` | 1284 bytes (was absent) | Added participant module |
| `execution/EXECUTION_CONTRACT.md` | 2159 bytes (was absent) | Added contract |
| `execution/EXECUTION_PROOF.md` | 1340 bytes (was absent) | Added proof |
| `sarathi/app.js` | 4690 bytes (was 3000) | Updated with JWKS, EdDSA, key persistence |
| `sarathi/key_persistence.js` | 6880 bytes (was absent) | Added key management |
| `sarathi/DURABILITY_PROOF.md` | 1899 bytes (was absent) | Added durability proof |
| `sarathi/KEY_ROTATION.md` | 1968 bytes (was absent) | Added key rotation docs |
| `sarathi/keys/*` | multiple | Added key files |
| `core/app.js` | 2743 bytes (was 2620) | Updated with cet_hash, headers |
| `bucket/Dockerfile` | 7 lines (was 15) | Simplified (no extra build deps) |

### Observability

| File | Status |
|---|---|
| `observability/telemetry_emitter.js` | Added |
| `observability/trace_collector.js` | Added |
| `observability/replay_hooks.js` | Added |
| `observability/schema.json` | Added |

### Replay Persistence

| File | Status |
|---|---|
| `replay_persistence/append_only_store.js` | Added |
| `replay_persistence/continuity_recorder.js` | Added |
| `replay_persistence/idempotency_store.js` | Added |
| `replay_persistence/jti_store.js` | Added (NEW - created during Phase 1a) |
| `replay_persistence/lineage_tracker.js` | Added |
| `replay_persistence/schema.json` | Added |
| `replay_persistence/DISTRIBUTED_REPLAY_PROOF.md` | Added |

### Replay Reconstruction

| File | Status |
|---|---|
| `replay_reconstruction/corruption_detector.js` | Added |
| `replay_reconstruction/demo_reconstruction.js` | Added |
| `replay_reconstruction/lineage_graph.js` | Added |
| `replay_reconstruction/reconstruction_tool.js` | Added |
| `replay_reconstruction/verification_flow.js` | Added |

### Docs & Proofs

| File | Status |
|---|---|
| `README.md` | Updated |
| `REVIEW_PACKET.md` | Added |
| `REPLAY_PROOF.md` | Added |
| `LIVE_EXECUTION_PROOF.md` | Added |
| `LIVE_PROOF_CHECKLIST.md` | Added |
| `PHASE2_SUMMARY.md` | Added |
| `terminal_demo.md` | Added |
| `DEPLOYMENT_PROOF.md` | Added |
| `FAILURE_PROOF.md` | Added |
| `FAILURE_TESTS.md` | Added |
| `FINAL_DEMO_SEQUENCE.md` | Added |
| `FINAL_GAP_ANALYSIS.md` | Added |
| `FINAL_SANITY_CHECK.md` | Added |
| `HEALTH_MATRIX.md` | Added |
| `HIDDEN_STATE_DISCLOSURE.md` | Added |
| `architecture.md` | Added |
| `BRIDGE_AUDIT.md` | Added |
| `AUDIT_*.md` (8 files) | Added |
| `CONSTITUTIONAL_REVIEW.md` | Added |
| `DRIFT_RISK_ANALYSIS.md` | Added |
| `curl_examples.sh` | Added |
| `docker-compose.yml` | Added |
| `review_packets/*` | Added |

### Unique Files Preserved (tantra_gated_bridge → services)

| File | New Location |
|---|---|
| `survivability_tests/ecosystem_proof.js` | `services/survivability_tests/ecosystem_proof.js` |
| `survivability_tests/run_lifecycle_tests.ps1` | `services/survivability_tests/run_lifecycle_tests.ps1` |
| `survivability_tests/run_lifecycle_tests.sh` | `services/survivability_tests/run_lifecycle_tests.sh` |
| `survivability_tests/proof/*` | `services/survivability_tests/proof/` |

## Files Removed (from duplication)

No files were removed — the `tantra_gated_bridge/services/` directory is now a mirror of the canonical `services/` with older versions replaced.

## Final Source of Truth

**`services/`** is the canonical source of truth for all service implementations, tests, and documentation.

**`tantra_gated_bridge/services/`** is a synchronized mirror for backwards compatibility and deployment tooling.

All new development should target `services/`.
