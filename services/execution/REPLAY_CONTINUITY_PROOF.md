# Replay Continuity Proof — Execution

## Guarantee
Every execution produces an append-only replay record with SHA-256 hash chaining.

## Record Structure
```json
{
  "trace_id": "uuid",
  "execution_id": "uuid",
  "parent_execution_id": "uuid|null",
  "event_type": "execution:phase",
  "service": "execution",
  "status": "completed|failed",
  "payload": { "phase": "workload", "duration_ms": 100 },
  "timestamp": "ISO-8601",
  "parent_hash": "sha256-of-previous",
  "sequence": 42,
  "hash": "sha256-of-this"
}
```

## Proof Commands

```bash
# Show all replay records
cat services/replay_persistence/data/replay_log.jsonl

# Validate chain integrity
node -e "
const store = require('./services/replay_persistence/append_only_store');
const r = store.validateChainIntegrity();
console.log('Valid:', r.valid, 'Records:', r.record_count, 'Errors:', r.errors.length);
"

# Reconstruct a specific trace
node services/replay_reconstruction/reconstruction_tool.js <trace_id>
```

## Continuous Proof
- Chain validation: `node services/replay_reconstruction/verification_flow.js`
- Survivability: `cd services/survivability_tests && node test_suite.js --proof`
