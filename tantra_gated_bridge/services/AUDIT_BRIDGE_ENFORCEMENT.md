# AUDIT: Bridge Zero-Trust Enforcement

## Objective
Determine whether Bridge is truly PASSIVE (validates + forwards only) or contains forbidden logic.

## Code Inspection Results

### Forbidden Pattern Scan (bridge/app.js)

| Pattern | grep Result | Status |
|---------|------------|--------|
| jwt.sign / generateToken / createToken | Not found | ✅ PASS |
| execute / eval / spawn / exec / fork | Not found (except variable names) | ✅ PASS |
| fallback / backup / alternative | Not found | ✅ PASS |
| writeFile / save / store / insert | Not found | ✅ PASS |
| retry / setTimeout (retry wrapper) | Not found | ✅ PASS |
| mock / fake / stub / simulate | Not found | ✅ PASS |

### What Bridge ACTUALLY Does

Lines 58-107: `validateToken` middleware
- Fetches public key from Sarathi (line 45-56)
- Decodes and verifies JWT with RS256, issuer check, audience check (line 72-76)
- Validates trace_id, execution_id, jti claims exist (line 80-89)
- Checks replay cache for jti reuse (line 92-98)
- Returns 401 on any failure (lines 63, 82, 88, 94, 105)

Lines 109-130: `enforceImmutableIds` middleware
- Compares token trace_id/execution_id with body (lines 117-124)
- Returns 400 on mutation (lines 119, 123)

Lines 138-176: POST /execute endpoint
- Forwards request to execution service via axios.post (line 145-157)
- Returns 503 on Execution unavailable (lines 170-174)
- Returns downstream error on Execution failure (lines 165-167)

### What Bridge does NOT do

1. ❌ Does NOT generate tokens (no `jwt.sign` anywhere)
2. ❌ Does NOT execute workloads (no execution/spawn/eval)
3. ❌ Does NOT store artifacts locally (no filesystem writes)
4. ❌ Does NOT have fallback paths (no catch blocks with alternative logic)
5. ❌ Does NOT retry on failure (single axios call, no retry wrapper)
6. ❌ Does NOT mock Sarathi (must fetch public key, no local key fallback)
7. ❌ Does NOT have degraded mode (always returns error on failure)

## Runtime Verification

| Test | Result | Status |
|------|--------|--------|
| Invalid token → 401 | `{"error":"Unauthorized: Invalid token"}` | ✅ |
| Tampered token → 401 | Signature verification fails | ✅ (proved by code) |
| ID mutation → 400 | `{"error":"trace_id mutation forbidden"}` | ✅ |
| Execution down → 503 | `{"error":"Execution service unavailable - system stopped"}` | ✅ |
| Replay token → 401 | `{"error":"Unauthorized: Token replay detected"}` | ✅ |

## ⚠ Weaknesses Found

1. **In-memory replay cache** (line 29): `replayCache = new Map()`. If Bridge restarts, the cache is lost. Old tokens can be replayed until JWT expiry. This is a reviewer risk.

2. **Public key cache indefinite** (line 46-50): `SARATHI_PUBLIC_KEY` is cached forever after first fetch. If Sarathi regenerates its key pair, Bridge will reject valid tokens until Bridge restarts. No key rotation mechanism.

3. **Bridge signature forwarding** (line 152): The bridge forwards the raw `Authorization` header as `bridge_signature` in the body. This exposes the full JWT in the request body to Execution. Not a security violation but a data hygiene concern.

4. **fetchPublicKey has no retry** (line 48-54): If Sarathi is temporarily unavailable during key fetch, Bridge will fail and cache the failure. The `SARATHI_PUBLIC_KEY` stays null, so every request will try to refetch. This is actually correct zero-trust behavior, but there's no circuit breaker.

## Final Verdict: ✅ PASSIVE — NO VIOLATIONS FOUND

```
Bridge Audit Result: PASS
===============================
✅ No token generation
✅ No execution logic
✅ No fallback paths
✅ No local storage
✅ No retry masking
✅ No mock authority
✅ Only validates and forwards
✅ Hard fails on dependency failure
✅ ID mutation enforcement
✅ Replay attack detection
===============================
```

### Reviewer Risk Severity: LOW

The Bridge implementation correctly enforces zero-trust boundaries. The in-memory replay cache is the most notable weakness but is acceptable for the stated scope of the project. The Bridge is genuinely passive.
