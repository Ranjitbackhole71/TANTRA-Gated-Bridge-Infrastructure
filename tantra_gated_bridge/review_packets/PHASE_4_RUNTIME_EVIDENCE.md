# TANTRA Gated Bridge - Phase 4 Runtime Evidence

Date: 2026-08-11

Scope: runtime evidence only. No runtime code was modified.

## Evidence Summary

| Check | Status | Evidence |
|---|---|---|
| Stack start | PASS | `.\scripts\start_all.ps1` completed and reported the stack running. Live containers were `deployment-core-1`, `deployment-sarathi-1`, `deployment-bridge-1`, `deployment-execution-1`, `deployment-bucket-1`, and `deployment-insightflow-1`, all `Up 7 minutes`. |
| All required services healthy | PASS | `.\scripts\verify_full_stack.ps1` reported Core, Sarathi, Bridge, Execution, and Bucket as `HEALTHY`. |
| Core -> Sarathi -> Bridge -> Execution -> Bucket flow | PASS | Live `/initiate` request returned `status: completed` with trace and execution IDs and a completed artifact location. |
| Replay record for live execution | PASS | The live replay log inside `deployment-execution-1` contained 5 records for the execution trace, sequences 409-413. |
| Replay reconstruction | PASS | The live replay log was reconstructed from the append-only store inside `deployment-execution-1`; the trace was found and reconstructed as 5 records. |
| Chain integrity | PASS | Container-side validation returned `{"valid":true,"record_count":413,"errors":[]}`. |
| Observability evidence | PASS | Live replay records for the execution were telemetry events with `payload.passive: true`; `node services/survivability_tests/ecosystem_proof.js` reported `7/7 contracts active`. |

## Live Execution

Requested workload:

```json
{"workload":"phase-4-runtime-evidence"}
```

Response:

```json
{
  "trace_id": "06a37370-0960-4a32-a1b0-5c3c622c4850",
  "execution_id": "237dbbd1-c3fd-4641-86f4-a358fd6c62f9",
  "cet_hash": "45a887c9d00258dcb5889d71a7f34ecd6fb65b0b5228e746ed9b42f84cf57171",
  "status": "completed",
  "artifact_location": "artifacts/06a37370-0960-4a32-a1b0-5c3c622c4850/237dbbd1-c3fd-4641-86f4-a358fd6c62f9",
  "duration_ms": 0
}
```

## Replay Evidence

The live replay log inside `deployment-execution-1` contained these records for the trace:

```json
{"trace_id":"06a37370-0960-4a32-a1b0-5c3c622c4850","execution_id":"237dbbd1-c3fd-4641-86f4-a358fd6c62f9","event_type":"telemetry:execution_transition","service":"execution","status":"validated","payload":{"telemetry":true,"passive":true,"from_status":"pending","transition_type":"state_change"}}
{"trace_id":"06a37370-0960-4a32-a1b0-5c3c622c4850","execution_id":"237dbbd1-c3fd-4641-86f4-a358fd6c62f9","event_type":"telemetry:response_sent","service":"bridge","status":"completed","payload":{"telemetry":true,"passive":true,"artifact_location":"artifacts/06a37370-0960-4a32-a1b0-5c3c622c4850/237dbbd1-c3fd-4641-86f4-a358fd6c62f9","duration_ms":0}}
{"trace_id":"06a37370-0960-4a32-a1b0-5c3c622c4850","execution_id":"237dbbd1-c3fd-4641-86f4-a358fd6c62f9","event_type":"telemetry:execution_transition","service":"execution","status":"completed","payload":{"telemetry":true,"passive":true,"from_status":"storing","transition_type":"state_change"}}
```

Container-side reconstruction result:

```json
{
  "found": true,
  "count": 5
}
```

## Chain Integrity

Container-side chain validation:

```json
{"valid":true,"record_count":413,"errors":[]}
```

## Observability Evidence

`node services/survivability_tests/ecosystem_proof.js` reported:

```text
PASS: OBS-CORE-001 - All telemetry events tagged passive:true
PASS: TEL-EXPORT-001 - All records parseable with valid schema
PASS: TRC-CONT-001 - Chain integrity valid (403 records)
PASS: TRC-CONT-002 - Reconstruction is read-only
PASS: REP-COMPAT-001 - All records have valid SHA-256 hashes
PASS: TRC-CONT-001b - Deterministic replay verified
PASS: OBS-CORE-002 - No telemetry event has execution authority
Summary: 7/7 contracts active
```

## Additional Verified Runtime Data

- `.\scripts\verify_full_stack.ps1` completed with `RESULT: FULL STACK VERIFIED - PASS`.
- The same verification run reported a successful execution with trace ID `579f9205-2eb7-490e-8930-aa835d32bf4d`.
- The container runtime replay log is located at `/app/replay_persistence/data/replay_log.jsonl` inside `deployment-execution-1`.

## Notes

- The live execution evidence above is from the container runtime context, which is the authoritative source for the stack state during this phase.
- The runtime evidence is marked PASS only where the live command output supported it directly.
