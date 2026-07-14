# TANTRA Gated Bridge — Versioning Policy

**Version**: 1.0.0
**Status**: Active

---

## 1. System Version

| Field | Value |
|---|---|
| Current Version | 1.0.0 |
| Versioning Scheme | Semantic Versioning (SemVer 2.0.0) |
| Registry | `CAPABILITY_DEFINITION.md` (Capability ID: `tantra-gated-bridge-v1`) |

### Version Format

```
MAJOR.MINOR.PATCH
```

| Component | Increment When |
|---|---|
| MAJOR | Breaking change to API contract, service topology, or JWT validation rules |
| MINOR | New feature, new service, new endpoint, new ecosystem contract — backward compatible |
| PATCH | Bug fix, documentation update, internal refactor — no API change |

### Current Version History

| Version | Date | Summary |
|---|---|---|
| 1.0.0 | 2026-07-07 | Initial capability registration. 6 services, 99/99 tests, full documentation. |

---

## 2. API Versioning

All API endpoints are unversioned (no `/v1/` prefix). Breaking API changes require a MAJOR version bump and are documented in the CHANGELOG.

| Endpoint | Current Contract |
|---|---|
| `POST /initiate` | Stable |
| `POST /token` | Stable |
| `POST /execute` | Stable |
| `POST /run` | Stable |
| `POST /store` | Stable |
| `GET /retrieve/:trace_id/:execution_id` | Stable |
| `GET /health` | Stable |
| `GET /.well-known/jwks.json` | Stable |
| `GET /jwks` | Stable |

---

## 3. JWT Token Versioning

| Property | Policy |
|---|---|
| Algorithm | RS256 (default), EdDSA (supported) |
| Issuer | `tantra-sarathi` (immutable) |
| Audience | `tantra-bridge` (immutable) |
| Claims | `trace_id`, `execution_id`, `cet_hash`, `jti`, `iss`, `aud`, `iat`, `exp` |
| Expiry | 1 hour (configurable via `JWT_EXPIRY_MS`) |
| Rotation | Supported via `key_persistence.rotateKeys()` |

### Backward Compatibility

- New JWT claims are additive only (optional fields)
- Existing claims are never removed or renamed
- Algorithm changes require MAJOR version bump
- `kid` header is stable and immutable per key pair

---

## 4. Replay Log Versioning

| Property | Policy |
|---|---|
| Format | JSONL (JSON Lines) |
| Hash Algorithm | SHA-256 (immutable) |
| Chain Structure | `parent_hash` linking (immutable) |
| Schema | `observability/schema.json` |

### Backward Compatibility

- New fields added to log entries are optional
- Existing fields are never removed or renamed
- Hash computation algorithm is immutable
- Chain integrity validation algorithm is deterministic and immutable

See `ECOSYSTEM_PARTICIPATION.md` contracts REP-COMPAT-001 and REP-COMPAT-002.

---

## 5. Ecosystem Contract Versioning

| Contract ID | Domain | Version | Status |
|---|---|---|---|
| OBS-CORE-001 | Observability | 1.0.0 | Active |
| OBS-CORE-002 | Observability | 1.0.0 | Active |
| TEL-EXPORT-001 | Telemetry Export | 1.0.0 | Active |
| TRC-CONT-001 | Trace Continuity | 1.0.0 | Active |
| TRC-CONT-002 | Trace Continuity | 1.0.0 | Active |
| REP-COMPAT-001 | Replay Compatibility | 1.0.0 | Active |
| REP-COMPAT-002 | Replay Compatibility | 1.0.0 | Active |

### Contract Change Policy

- Contract changes require MINOR or MAJOR version bump
- Deprecated contracts are documented but never removed without MAJOR bump
- New contracts are additive (new IDs, new domains)

---

## 6. Docker Image Versioning

| Property | Policy |
|---|---|
| Base Image | `node:18-alpine` |
| Image Tags | `latest` (current), version tags on release |
| Compose Files | Versioned by filename (`docker-compose.yml`, `docker-compose.original.yml`) |

---

## 7. Deprecation Policy

| Phase | Duration | Action |
|---|---|---|
| Announced | 0-3 months | Documented in CHANGELOG and Known Limitations |
| Deprecated | 3-6 months | Emits warning logs, still functional |
| Removed | 6+ months | Removed in next MAJOR version |

### Currently Deprecated Items

None.

---

## 8. Documentation Versioning

| Document | Version Tracking |
|---|---|
| REVIEW_PACKET.md | Header `Version` field |
| CODE_PACKET.md | Header `Version` field |
| CAPABILITY_DEFINITION.md | Header `Version` field |
| All other docs | Last modified date in git |

---

## References

| Document | Location |
|---|---|
| Capability Definition | `CAPABILITY_DEFINITION.md` |
| Ecosystem Contracts | `tantra_gated_bridge/docs/ECOSYSTEM_PARTICIPATION.md` |
| Replay Compatibility | `tantra_gated_bridge/docs/ECOSYSTEM_PARTICIPATION.md` (REP-COMPAT-001/002) |
| Known Limitations | `docs/KNOWN_LIMITATIONS.md` |
