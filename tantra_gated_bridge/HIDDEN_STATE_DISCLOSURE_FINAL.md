# TANTRA Gated Bridge — Hidden State Disclosure Final

## Declaration

This document discloses ALL state maintained by the TANTRA Gated Bridge system. Every piece of state is enumerated, described, and its authority classified. No hidden mutable runtime authority exists.

## 1. Persistent State (Survives Restart)

### 1.1 Replay Log

| Property | Value |
|---|---|
| Location | `services/replay_persistence/data/replay_log.jsonl` |
| Format | JSONL (append-only) |
| Content | All replay, telemetry, and trace events |
| Size | Grows monotonically |
| Authority | None (append-only) |
| Encryption | None |
| Accessibility | Readable by any process with file access |

### 1.2 Chain State

| Property | Value |
|---|---|
| Location | `services/replay_persistence/data/replay_chain.json` |
| Format | JSON |
| Content | `{ last_hash, record_count }` |
| Size | ~100 bytes |
| Authority | None (verification only) |
| Encryption | None |

### 1.3 Bucket Database

| Property | Value |
|---|---|
| Location | `services/bucket/bucket.db` |
| Format | SQLite |
| Content | Execution artifacts with SHA-256 hashes |
| Authority | Storage only |
| Encryption | None |

## 2. In-Memory State (Cleared on Restart)

### 2.1 Sarathi Token Cache

| Property | Value |
|---|---|
| Location | `sarathi/app.js` — `tokenCache` Map |
| Content | jti -> expiry timestamp |
| TTL | 1 hour (auto-cleaned every 60s) |
| Size | Number of tokens issued in last hour |
| Authority | Replay detection only |
| Restart behavior | Cleared — new key pair generated if not in env |

### 2.2 Bridge Replay Cache

| Property | Value |
|---|---|
| Location | `bridge/app.js` — `replayCache` Map |
| Content | jti -> timestamp |
| TTL | 1 hour (auto-cleaned every 60s) |
| Size | Number of unique jtis seen in last hour |
| Authority | Replay detection only |
| Restart behavior | Cleared — public key re-fetched from Sarathi |

### 2.3 Sarathi Public Key Cache

| Property | Value |
|---|---|
| Location | `bridge/app.js` — `SARATHI_PUBLIC_KEY` variable |
| Content | RSA public key (PEM) |
| Authority | Token signature verification only |
| Restart behavior | Cleared — re-fetched from Sarathi |

### 2.4 Execution Public Key Cache

| Property | Value |
|---|---|
| Location | `execution/app.js` — `SARATHI_PUBLIC_KEY` variable |
| Content | RSA public key (PEM) |
| Authority | Bridge signature verification only |
| Restart behavior | Cleared — re-fetched from Sarathi |

### 2.5 Idempotency Store

| Property | Value |
|---|---|
| Location | `replay_persistence/idempotency_store.js` — `processedIds` Set |
| Content | Record identifiers already processed |
| Authority | Idempotency dedup only |
| Restart behavior | Lazily re-populated from log file on first check |

## 3. Transient State (Per-Request)

### 3.1 Core Request State

- `trace_id` (UUID) — generated per `/initiate` request
- `execution_id` (UUID) — generated per `/initiate` request
- JWT token — obtained from Sarathi, forwarded to Bridge

### 3.2 Bridge Request State

- `req.tokenData` — decoded JWT claims (trace_id, execution_id, jti)
- `req.trace_id` / `req.execution_id` — immutable IDs extracted from token

### 3.3 Execution Request State

- `req.bridgeTokenData` — decoded JWT from bridge signature header
- `req.trace_id` / `req.execution_id` — immutable IDs from token

### 3.4 Bucket Request State

- Request body — validated for required fields
- Computed hash — SHA-256 of artifact data

## 4. State Authority Matrix

| State Item | Readable By | Writable By | Authority |
|---|---|---|---|
| `replay_log.jsonl` | All processes | `append_only_store.js` only | Append-only |
| `replay_chain.json` | All processes | `append_only_store.js` only | Append-only |
| `bucket.db` | Bucket service only | Bucket service only | Storage |
| `tokenCache` | Sarathi only | Sarathi only | Replay detection |
| `replayCache` | Bridge only | Bridge only | Replay detection |
| `SARATHI_PUBLIC_KEY` (Bridge) | Bridge only | Bridge only | Verification |
| `SARATHI_PUBLIC_KEY` (Execution) | Execution only | Execution only | Verification |
| `processedIds` | Replay persistence only | Replay persistence only | Idempotency |

## 5. Zero Hidden State Declaration

After exhaustive audit:

- **No hidden mutable runtime authority exists**
- **No state is accessible outside its declaring module**
- **No state can alter execution flow of other modules**
- **No state persists across restarts except the append-only log and SQLite database**
- **No module can read or modify another module's state**

## 6. Verification

```bash
# Verify no unexpected state files
find services -name "*.jsonl" -o -name "*.json" -o -name "*.db" 2>/dev/null

# Expected:
# services/replay_persistence/data/replay_log.jsonl
# services/replay_persistence/data/replay_chain.json
# services/bucket/bucket.db
```
