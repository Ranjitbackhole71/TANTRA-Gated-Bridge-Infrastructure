# TANTRA Gated Bridge - Runtime Integration Map

Scope: documentary evidence only. This map uses the Phase 1 audit and repository documentation; it does not add new runtime evidence.

## Integration Map

| Source | Target | Documented Relationship | Status | Evidence |
|---|---|---|---|---|
| Core | Sarathi | Core generates trace and execution IDs, then requests a JWT | Verified in docs | `review_packets/RUNTIME_CONVERGENCE_AUDIT.md`, `review_packets/REVIEW_PACKET_FINAL_RUNTIME_ACCEPTANCE.md` |
| Sarathi | Bridge | Sarathi issues JWTs and Bridge validates them via JWKS | Verified in docs | `docs/ECOSYSTEM_PARTICIPATION.md`, `review_packets/RUNTIME_CONVERGENCE_AUDIT.md` |
| Bridge | Execution | Bridge forwards the request to Execution after validation | Verified in docs | `review_packets/RUNTIME_CONVERGENCE_AUDIT.md` |
| Execution | Bucket | Execution stores artifacts in Bucket with read-after-write verification | Verified in docs | `review_packets/RUNTIME_CONVERGENCE_AUDIT.md`, `review_packets/REVIEW_PACKET_FINAL_RUNTIME_ACCEPTANCE.md` |
| Observability | Replay persistence | Passive telemetry is appended to the replay log | Verified in docs | `docs/ECOSYSTEM_PARTICIPATION.md`, `docs/README.md` |
| Replay persistence | Replay reconstruction | Reconstruction reads the append-only log and verifies chain integrity | Verified in docs | `docs/ECOSYSTEM_PARTICIPATION.md`, `docs/README.md` |
| Survivability tests | All services | 7 scenarios are documented as covering the stack | Verified in docs | `docs/README.md`, `review_packets/REVIEW_PACKET_FINAL_CONVERGENCE.md` |

## Partial or Missing Integrations

| Area | Documented Gap | Status | Evidence |
|---|---|---|---|
| Runtime participant | Execution is still described as simulated in the reviewed documentation; `EXECUTION_PARTICIPANT` is not documented as active | Missing / partial | `review_packets/PHASE_1_AUDIT.md`, `review_packets/RUNTIME_CONVERGENCE_AUDIT.md`, `review_packets/RUNTIME_CONVERGENCE_DASHBOARD.md` |
| InsightFlow | The repository documents a passive stub and a local-only receiver, but Phase 1 says no external InsightFlow endpoint is configured | Partial / unverified externally | `docs/ECOSYSTEM_PARTICIPATION.md`, `review_packets/PHASE_1_AUDIT.md`, `review_packets/REVIEW_PACKET_FINAL_RUNTIME_ACCEPTANCE.md` |
| Replay cache durability | The docs now describe process-scoped cache rehydration, but distributed persistent replay protection is still called out as external | Partial | `docs/README.md`, `review_packets/PHASE_1_AUDIT.md`, `review_packets/REVIEW_PACKET_FINAL_CONVERGENCE.md` |
| Cross-node replication | No documented implementation in the reviewed materials | Missing | `review_packets/PHASE_1_AUDIT.md`, `review_packets/REVIEW_PACKET_FINAL_CONVERGENCE.md` |
| CI/CD | Verification remains script-driven in the reviewed docs | Missing | `review_packets/PHASE_1_AUDIT.md`, `review_packets/REVIEW_PACKET_FINAL_CONVERGENCE.md` |

## External Dependency Summary

| Dependency | Documented Need | Status |
|---|---|---|
| InsightFlow URL / API key / health endpoint | Requested in the runtime audit | Unverified external dependency |
| Runtime participant endpoint / contract | Requested in the runtime audit | Unverified integration dependency |
| Distributed replay protection store | Redis or similar is called out in the convergence packet | Unverified external dependency |
| Multi-node log aggregation | ELK / Loki / similar is called out for multi-node reconstruction | Unverified external dependency |

## Notes

- This map separates documented internal service links from external dependency claims.
- It does not claim that the partial items are complete.
- Where the documentation disagrees, the Phase 1 audit is treated as the source of truth for what remains unverified.
