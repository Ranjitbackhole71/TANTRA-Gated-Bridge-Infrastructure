# Hidden State Disclosure — TANTRA Survivability Phase

## 1. Mandatory Disclosure

This document discloses every piece of hidden, accumulated, or transient runtime state introduced or relied upon by the survivability, replay, and observability modules. This is a zero-excuses accountability disclosure.

---

## 2. Explicitly Declared State

### 2.1 File-Backed Persistent State

| File | Content | Purpose | Recreatable? |
|---|---|---|---|
| `replay_persistence/data/replay_log.jsonl` | Append-only JSONL record log | Replay trace storage | Yes, from execution events |
| `replay_persistence/data/replay_chain.json` | `{last_hash, record_count}` | Chain integrity tracking | Yes, by re-reading the log |
| `replay_persistence/data/artifact_index.json` | `{artifactId -> position}` | Fast lookup index | Yes, rebuilt from log |
| `replay_persistence/data/chain_state.json` | `{last_hash, artifact_count}` | Append-only chain state | Yes, rebuilt from log |

All file state is:
- Deterministically recreatable from the append-only log
- Rebuildable by re-scanning `replay_log.jsonl`
- Non-authoritative (if deleted, integrity validation fails but no execution is affected)

### 2.2 In-Memory Transient State

| Variable | Module | Purpose | Lifetime | Recreatable? |
|---|---|---|---|---|
| `processedIds` (Set) | `idempotency_store.js` | Idempotency dedup cache | Process lifetime | Yes, from log |
| `replayCache` (Map) | `bridge/app.js` (existing) | JWT replay detection | Process lifetime | No (TTL-based) |
| `tokenCache` (Map) | `sarathi/app.js` (existing) | JTI expiry tracking | Process lifetime | No (TTL-based) |
| `SARATHI_PUBLIC_KEY` (var) | `bridge/app.js` (existing) | Public key caching | Process lifetime | Yes, re-fetched |

---

## 3. State That Does NOT Exist (Proactive Disclosure)

| Hypothetical State | Where It Would Be | Declared ABSENT Because |
|---|---|---|
| Execution queue | `replay_persistence/` | No queue data structure exists |
| Token cache | `replay_persistence/` | No JWT creation or storage |
| Decision cache | `replay_persistence/` | No decision logic exists |
| Routing table | `replay_persistence/` | No URL or service address storage |
| Governance rules | `replay_persistence/` | No rule engine or policy storage |
| Hidden mutable runtime authority | Any module | All state is append-only or read-only |

---

## 4. State Authority Analysis

### 4.1 Can any state grant execution authority?

**No.** None of the disclosed state can:
- Create or sign JWTs
- Bypass Bridge validation
- Modify execution results
- Override rejection decisions
- Grant access to protected resources

### 4.2 Can any state accumulate authority over time?

**No.** File-backed state is append-only. In-memory state is either:
- A cache (`processedIds`) that can be cleared without system impact
- A passive reference (`replayCache`) that records past events without granting future authority

### 4.3 Can any state survive restart to accumulate authority?

**No.** All in-memory state is process-scoped. File-backed state is read-only during execution (append-only). The runtime loads chain state for integrity verification, not for authorization.

---

## 5. State Verifiability

Every piece of disclosed state can be verified by:
1. **Source code inspection**: All state is explicitly declared in module-level variables
2. **Runtime dump**:
   ```
   node -e "const s=require('./replay_persistence/append_only_store'); console.log(JSON.stringify(s.getChainState()))"
   ```
3. **File audit**: `replay_persistence/data/` directory listing shows all file state
4. **Integrity validation**:
   ```
   node -e "const s=require('./replay_persistence/append_only_store'); console.log(JSON.stringify(s.validateChainIntegrity()))"
   ```

---

## 6. Summary

| State Type | Count | Authoritative? | Restart-Safe? | Accumulates? |
|---|---|---|---|---|
| File-backed (append-only) | 4 files | No (verification only) | Yes | No (append-only) |
| In-memory (idempotency) | 1 Set | No | No (cleared) | No (process-scoped) |
| In-memory (bridge legacy) | 3 vars | No | No (cleared) | No (TTL/cache) |

**Zero hidden mutable runtime authority exists.**
