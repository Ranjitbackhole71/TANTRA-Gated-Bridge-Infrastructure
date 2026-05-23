# AUDIT: JWT Security

## RS256 Implementation

| Check | Status | Evidence |
|-------|--------|----------|
| RS256 algorithm configured | ✅ STRONG | `algorithm: 'RS256'` in sarathi/app.js:85 |
| Private key generation | ✅ STRONG | RSA 2048-bit via `crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })` in sarathi/app.js:42-50 |
| Public key exposure | ✅ STRONG | GET /public-key endpoint in sarathi/app.js:98-100 |
| No HS256 fallback | ✅ STRONG | Only RS256 specified in jwt.sign options |

## Issuer Validation

| Check | Status | Evidence |
|-------|--------|----------|
| Issuer set in token | ✅ STRONG | `iss: 'tantra-sarathi'` in sarathi/app.js:79 |
| Issuer validated by Bridge | ✅ STRONG | `issuer: 'tantra-sarathi'` in bridge/app.js:74 |
| Issuer validated by Execution | ✅ STRONG | `issuer: 'tantra-sarathi'` in execution/app.js:56 |

## Expiry Validation

| Check | Status | Evidence |
|-------|--------|----------|
| Token expiry set | ✅ STRONG | `expiresIn: process.env.JWT_EXPIRY || '1h'` in sarathi/app.js:86 |
| Expiry enforced by jwt.verify | ✅ STRONG | `jwt.verify` automatically rejects expired tokens in bridge/app.js:72 and execution/app.js:54 |
| Configurable TTL | ✅ STRONG | JWT_EXPIRY env var, default 1 hour |

## Signature Validation

| Check | Status | Evidence |
|-------|--------|----------|
| Signature created with private key | ✅ STRONG | Signed with PRIVATE_KEY (line 83) |
| Signature verified with public key | ✅ STRONG | Verified with PUBLIC_KEY from Sarathi (line 72) |
| No signature bypass paths | ✅ STRONG | jwt.verify with RS256 algorithm enforcement |
| Tampered token rejection | ✅ STRONG | jwt.verify throws on signature mismatch |

## ⚠ Replay Protection Analysis

| Check | Status | Evidence |
|-------|--------|----------|
| jti claim generated | ✅ STRONG | `jti: crypto.randomUUID()` in sarathi/app.js:71 |
| jti stored in Sarathi | ⚠ WEAK | In-memory Map (tokenCache) at sarathi/app.js:24 |
| jti validated by Bridge | ⚠ WEAK | In-memory Map (replayCache) at bridge/app.js:29 |
| Replay detection | ✅ STRONG | `replayCache.has(decoded.jti)` at bridge/app.js:92 |
| Cache survives restart | ❌ MISSING | Both caches are in-memory only |

### Why Replay Protection is ⚠ WEAK (not ❌ MISSING)

The replay protection mechanism EXISTS and WORKS (verified by runtime test — same token used twice returns 401 with "Token replay detected"). However:

1. **In-memory cache is ephemeral**: If Bridge restarts, the replay cache is lost. The same token can be reused until its natural JWT expiry (up to 1 hour).

2. **Sarathi side cache is redundant**: Sarathi tracks jti in `tokenCache` but never uses it for enforcement. The enforcement happens in Bridge. The Sarathi cache is essentially dead code for replay protection.

3. **No persistent replay database**: There is no SQLite/file-backed replay log that would survive restarts.

### Reviewer Risk

For a demo/prototype system, the in-memory replay cache is acceptable. For a production system, this would need to be backed by persistent storage (Redis, SQLite, etc.).

## Claim Verification via jwt.io

The token structure was verified:
```json
{
  "trace_id": "replay-test-1",
  "execution_id": "replay-e-1",
  "iss": "tantra-sarathi",
  "aud": "tantra-bridge",
  "jti": "2d5171a6-...",
  "iat": 1778297080,
  "exp": 1778300680
}
```

Claims: trace_id ✅, execution_id ✅, iss ✅, aud ✅, jti ✅, iat ✅, exp ✅

## Summary

| Security Check | Status | Grade |
|---------------|--------|-------|
| RS256 algorithm | Implemented | ✅ STRONG |
| Issuer validation | Implemented | ✅ STRONG |
| Audience validation | Implemented | ✅ STRONG |
| Expiry validation | Implemented | ✅ STRONG |
| Signature validation | Implemented | ✅ STRONG |
| jti claim generation | Implemented | ✅ STRONG |
| Replay detection | Implemented | ⚠ WEAK |
| Persistent replay cache | Not implemented | ❌ MISSING |
| Key rotation | Not implemented | ❌ MISSING |
