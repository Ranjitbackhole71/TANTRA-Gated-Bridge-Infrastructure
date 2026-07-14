# TANTRA Gated Bridge — Central Depository Package

**Version**: 1.0.0
**Date**: 2026-07-14
**Capability ID**: `tantra-gated-bridge-v1`

---

## 1. Package Manifest

| Field | Value |
|---|---|
| Package Name | `tantra-gated-bridge` |
| Version | 1.0.0 |
| Capability ID | `tantra-gated-bridge-v1` |
| Domain | Domain 3 — Secure Workload Execution |
| Classification | Infrastructure — Distributed Execution Pipeline |
| Owner | TANTRA Platform Team |
| Repository | `https://github.com/Ranjitbackhole71/TANTRA-Gated-Bridge-Infrastructure.git` |
| Branch | `master` |
| Last Verified | 2026-07-09 |

---

## 2. Source Repository Reference

The canonical source code lives in the repository root under `services/`. This depository package indexes and references those files — it does not duplicate them.

### Canonical Source Locations

| Component | Path | Lines |
|---|---|---|
| Core Service | `services/core/app.js` | ~115 |
| Sarathi Service | `services/sarathi/app.js` | ~172 |
| Bridge Service | `services/bridge/app.js` | ~275 |
| Execution Service | `services/execution/app.js` | ~242 |
| Bucket Service | `services/bucket/app.js` | ~202 |
| Key Persistence | `services/sarathi/key_persistence.js` | ~105 |
| Replay Persistence | `services/replay_persistence/` | 5 modules |
| Replay Reconstruction | `services/replay_reconstruction/` | 5 modules |
| Observability | `services/observability/` | 4 modules |
| InsightFlow | `services/insightflow/` | 4 files |
| Survivability Tests | `services/survivability_tests/` | 4 modules |

---

## 3. Documentation Index

### Core Documentation

| Document | Location | Purpose |
|---|---|---|
| Architecture | `docs/ARCHITECTURE.md` | System design and data flow |
| API Reference | `docs/API.md` | All endpoints and schemas |
| Deployment Guide | `docs/DEPLOYMENT.md` | Installation and deployment |
| Configuration | `docs/CONFIGURATION.md` | Environment variables |
| Operational Runbook | `docs/OPERATIONAL_RUNBOOK.md` | Monitoring and troubleshooting |
| Recovery Guide | `docs/RECOVERY_GUIDE.md` | Disaster recovery procedures |
| Maintenance Guide | `docs/MAINTENANCE_GUIDE.md` | Routine maintenance tasks |
| Integration Map | `docs/INTEGRATION_MAP.md` | Service dependencies and API contracts |
| Known Limitations | `docs/KNOWN_LIMITATIONS.md` | Architecture and security limitations |

### Milestone Documentation (New)

| Document | Location | Purpose |
|---|---|---|
| Versioning Policy | `docs/VERSIONING_POLICY.md` | Semantic versioning, API versioning, deprecation |
| Compatibility Matrix | `docs/COMPATIBILITY_MATRIX.md` | Runtime, OS, Docker, library compatibility |
| Runtime Modes | `docs/RUNTIME_MODES.md` | Docker and Native mode documentation |
| Attachment Guide | `docs/ATTACHMENT_GUIDE.md` | How to attach to TANTRA pipeline |
| Consumer Guide | `docs/CONSUMER_GUIDE.md` | How to consume TANTRA services |
| Extension Guidelines | `docs/EXTENSION_GUIDELINES.md` | How to extend TANTRA |
| Integration Guide | `docs/INTEGRATION_GUIDE.md` | Step-by-step integration instructions |
| Custodian Documentation | `docs/CUSTODIAN_DOCUMENTATION.md` | Maintenance, ownership, onboarding |
| Enterprise Handover | `docs/ENTERPRISE_HANDOVER.md` | Enterprise handover package |
| Ecosystem Attachment Registry | `docs/ECOSYSTEM_ATTACHMENT_REGISTRY.md` | All ecosystem participants |

### Handover Documents

| Document | Location | Purpose |
|---|---|---|
| Handover Packet | `FINAL_HANDOVER_PACKET.md` | Complete handover documentation |
| Acceptance Evidence | `ACCEPTANCE_EVIDENCE.md` | Test execution results |
| Capability Definition | `CAPABILITY_DEFINITION.md` | Capability metadata and registration |
| Current State Report | `CURRENT_STATE_REPORT.md` | Repository state snapshot |

---

## 4. Architecture References

| Document | Location |
|---|---|
| System Topology | `docs/ARCHITECTURE.md` |
| Service Roles | `docs/ARCHITECTURE.md` §Service Responsibilities |
| Security Model | `docs/ARCHITECTURE.md` §Security Model |
| Data Flow | `docs/ARCHITECTURE.md` §Data Flow |
| Technology Stack | `docs/ARCHITECTURE.md` §Technology Stack |
| Constitutional Boundary | `tantra_gated_bridge/CONSTITUTIONAL_BOUNDARY_FINAL.md` |

---

## 5. Runtime References

| Document | Location |
|---|---|
| Live Runtime Evidence | `REVIEW_PACKET.md` §Live Runtime Evidence |
| Service Health | `REVIEW_PACKET.md` §Service Health |
| E2E Workflow | `REVIEW_PACKET.md` §E2E Workflow Execution |
| JWKS Endpoint | `REVIEW_PACKET.md` §JWKS Endpoint |
| Key Persistence | `REVIEW_PACKET.md` §Key Persistence |
| Replay Chain | `REVIEW_PACKET.md` §Replay Chain |
| Setu Lifecycle | `REVIEW_PACKET.md` §Setu User Product Lifecycle |

---

## 6. Deployment References

| Document | Location |
|---|---|
| Docker Compose | `services/docker-compose.yml` |
| Production Compose | `deployment/docker-compose.yml` |
| Dockerfiles | `services/*/Dockerfile` (5 files) |
| Start Scripts | `scripts/start.sh`, `scripts/start.ps1` |
| Stop Scripts | `scripts/stop.sh`, `scripts/stop.ps1` |
| Verify Scripts | `scripts/verify.sh`, `scripts/verify.ps1` |
| Convergence Proof | `scripts/convergence_proof.sh`, `scripts/convergence_proof.ps1` |
| Deployment Scripts | `deployment/deploy.sh`, `deployment/rollback.sh`, `deployment/startup.sh`, `deployment/verify_health.sh` |

---

## 7. Configuration References

| Document | Location |
|---|---|
| Environment Variables | `docs/CONFIGURATION.md` |
| Global Env Template | `tantra_gated_bridge/configs/.env.example` |
| Core Config | `services/core/.env` |
| Sarathi Config | `services/sarathi/.env` |
| Bridge Config | `services/bridge/.env` |
| Execution Config | `services/execution/.env` |
| Bucket Config | `services/bucket/.env` |
| YAML Configs | `config/base.yaml`, `config/development.yaml`, `config/production.yaml`, `config/staging.yaml` |
| Observability Schema | `services/observability/schema.json` |
| Replay Schema | `services/replay_persistence/schema.json` |

---

## 8. REVIEW_PACKET

| Document | Location | Version | Date |
|---|---|---|---|
| Canonical Review Packet | `REVIEW_PACKET.md` | v4.0.0 | 2026-07-13 |
| Final Convergence Packet | `FINAL_GATED_BRIDGE_CONVERGENCE.md` | 1.0.0 | 2026-07-14 |
| Final Review Packet | `FINAL_REVIEW_PACKET.md` | — | 2026-07-09 |
| Completion Review | `services/review_packets/REVIEW_PACKET_FINAL_COMPLETION.md` | — | 2026-05-30 |
| Survivability Review | `services/review_packets/REVIEW_PACKET_SURVIVABILITY_V1.md` | — | — |
| Runtime Convergence | `tantra_gated_bridge/review_packets/REVIEW_PACKET_FINAL_RUNTIME_CONVERGENCE.md` | — | 2026-06-10 |
| Runtime Acceptance | `tantra_gated_bridge/review_packets/REVIEW_PACKET_FINAL_RUNTIME_ACCEPTANCE.md` | — | 2026-07-07 |
| Final Convergence (Legacy) | `tantra_gated_bridge/review_packets/REVIEW_PACKET_FINAL_CONVERGENCE.md` | — | 2026-05-23 |

---

## 9. CODE_PACKET

| Document | Location | Version | Date |
|---|---|---|---|
| Code Packet | `CODE_PACKET.md` | v1.0.0 | 2026-07-09 |
| Enhanced Code Packet | `CODE_PACKET_ENHANCED.md` | 1.0.0 | 2026-07-14 |

---

## 10. HANDOVER_PACKET

| Document | Location | Date |
|---|---|---|
| Final Handover Packet | `FINAL_HANDOVER_PACKET.md` | 2026-07-09 |
| Enterprise Handover | `docs/ENTERPRISE_HANDOVER.md` | 2026-07-14 |
| Custodian Documentation | `docs/CUSTODIAN_DOCUMENTATION.md` | 2026-07-14 |

---

## 11. Ownership Metadata

| Field | Value |
|---|---|
| Organization | TANTRA Platform Team |
| Repository Owner | Ranjitbackhole71 |
| Primary Contact | TANTRA Platform Team |
| Escalation | See `docs/CUSTODIAN_DOCUMENTATION.md` §9 |

---

## 12. Version Information

| Component | Version | Date |
|---|---|---|
| System Version | 1.0.0 | 2026-07-07 |
| Package Version | 1.0.0 | 2026-07-14 |
| Capability Version | 1.0.0 | 2026-07-07 |
| Review Packet Version | 4.0.0 | 2026-07-13 |
| Code Packet Version | 1.0.0 | 2026-07-09 |

---

## 13. Acceptance Status

| Criterion | Status |
|---|---|
| All 20 requirements satisfied | Complete |
| 101/101 tests passing | Verified |
| 30/30 verified claims | Verified |
| Documentation suite complete | 21 documents |
| Review packet complete | Canonical v4.0.0 |
| Code packet complete | v1.0.0 |
| Handover packet complete | FINAL_HANDOVER_PACKET.md |
| Custodian documentation complete | docs/CUSTODIAN_DOCUMENTATION.md |

---

## References

| Document | Location |
|---|---|
| README | `README.md` |
| Capability Definition | `CAPABILITY_DEFINITION.md` |
| Acceptance Evidence | `ACCEPTANCE_EVIDENCE.md` |
| Final Submission Status | `FINAL_SUBMISSION_STATUS.md` |
