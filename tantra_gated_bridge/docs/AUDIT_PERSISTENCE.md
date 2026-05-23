# AUDIT: Bucket Persistence

## Storage Backend

| Property | Status | Details |
|----------|--------|---------|
| Storage engine | ✅ SQLite | `better-sqlite3` package |
| Database file | ✅ EXISTS | services/bucket/bucket.db (12,288 bytes) |
| Artifacts table | ✅ EXISTS | Columns: location, trace_id, execution_id, result, timestamp, duration_ms, stored_at, hash, created_at |
| Data survives restart | ✅ CONFIRMED | Artifacts remain after process restart (tested via read-after-write) |

## Read-After-Write Verification

The store endpoint performs mandatory read-after-write (bucket/app.js:102-136):

1. Insert artifact with SHA-256 hash (line 84-98)
2. Read back artifact by location (line 103)
3. Verify artifact exists (line 105-114)
4. Verify hash matches (line 117-125)
5. Verify schema validity (line 128-136)
6. If ANY check fails → DELETE and return 500

This was verified during testing:
```
POST /store → {"verified":true, "persistent":true, "hash":"18e8da96..."}
```

## SQLite Direct Verification

```
$ node -e "const Database = require('better-sqlite3'); ..."

Artifact count: 6
Recent artifacts:
- trace_id: replay-test-1, execution_id: replay-e-1, hash: 4fcbbb46...
- trace_id: persist-test, execution_id: persist-e, hash: 18e8da96...
- trace_id: d2aab052-..., execution_id: 6019f8e1-..., hash: 6285ceef...
```

## Retrieval Verification

```
GET /retrieve/persist-test/persist-e
→ {
    "trace_id": "persist-test",
    "execution_id": "persist-e", 
    "result": {"test": true},
    "hash": "18e8da96ba8b3dc7adcb4de6625f0569627c054ffffe2de08c792ca1a1f4b694"
  }
```

## Hash Verification

SHA-256 hash is:
- Generated at store time (bucket/app.js:75-78)
- Stored in database (line 97)
- Verified on read-after-write (line 117)
- The hash covers the full artifact JSON

## Schema Validation

Required fields enforced at store time (bucket/app.js:49-58):
- trace_id and execution_id required (line 49-52)
- result required (line 55-58)
- All required fields stored as NOT NULL in schema (line 14-24)

## ⚠ Weaknesses

1. **No database backup**: No replication, no WAL mode configured, no backup mechanism
2. **No migration system**: Schema is created by `CREATE TABLE IF NOT EXISTS` — no versioning
3. **Single `INSERT OR REPLACE`**: Will silently overwrite artifacts with same location
4. **No access control**: Any caller can store/retrieve artifacts (no auth on bucket endpoints)
5. **No read-after-write on restart**: The bucket.db file survives restart, but there is no explicit restart-recovery test in the codebase
6. **No cleanup/TTL**: Artifacts accumulate indefinitely

## Verdict: ✅ REAL PERSISTENCE

Storage is SQLite-backed and persistent across restarts. This is not in-memory-only storage. Hash verification and read-after-write provide data integrity guarantees. The implementation is functional for a prototype but lacks production durability features.

**Grade**: ⚠ Functional prototype — real persistence with integrity verification, but missing backup, migration, and access control.
