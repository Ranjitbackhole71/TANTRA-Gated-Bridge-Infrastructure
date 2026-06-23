# Replay Durability Proof

## Claim

JTIs (token replay protection) survive service restart.

## Problem

The Bridge service previously maintained an in-memory `Map<jti, timestamp>` for detecting token replay attacks. On restart, this cache was empty, allowing replayed JTIs to be accepted.

## Solution

Created `services/replay_persistence/jti_store.js` that:
1. Records each JTI to the append-only SHA-256 hash chain on disk
2. On startup, warms the in-memory cache from all previously recorded JTIs
3. Rejects duplicate JTIs (detected from both memory and disk)
4. Survives process restart — the module is freshly loaded, and `warmJtiCache()` replays all JTIs from the durable log

## Proof

### Before Fix: JTI lost after restart
```
Recording JTI → restart → JTI gone → replay accepted
```

### After Fix: JTI survives restart
```
Recording JTI → restart → JTI loaded from disk → replay rejected
```

### Test Output

```
=== JTI DURABILITY TEST (real restart simulation) ===

1. Recording JTI in session 1: test-jti-575c9479-4858-4ff2-98b4-cf009b4a0643
   Result: RECORDED

2. Simulating process restart (clearing module cache)...

3. Checking JTI after restart...
   hasJti: YES (survived restart!)

4. Testing duplicate rejection after restart...
   Duplicate: CORRECTLY REJECTED

=== SUMMARY ===
JTI survives restart: PASS
Duplicate rejection: PASS
```

### Files Changed

| File | Change |
|---|---|
| `services/replay_persistence/jti_store.js` | NEW — durable JTI persistence layer |
| `services/bridge/app.js` | UPDATED — uses jti_store instead of in-memory Map |

## Verification

1. JTI recorded to append-only log (`replay_log.jsonl`) with `event_type: 'jti_used'`
2. On module load, `warmJtiCache()` replays all JTIs into memory
3. `hasJti()` checks both in-memory cache and disk-backed store
4. `recordJti()` prevents duplicates by checking memory first, then store

## Conclusion

Replay protection survives restart. JTIs are durably persisted.
