# Drift Risk Analysis — TANTRA Surviviability Phase

## 1. Purpose

This document analyzes the risk that the replay persistence, reconstruction, observability, and survivability modules could drift from their intended passive/verification-only roles into unauthorized orchestration, governance, or execution authority.

---

## 2. Drift Vectors

### 2.1 Replay Persistence → Orchestration Engine

**Risk**: The append-only store could be modified to include retry logic, fallback execution paths, or autonomous decision-making.

**Mitigations**:
- `append_only_store.js` has zero HTTP client dependencies — no `axios`, `fetch`, or `http.request` imports
- `continuity_recorder.js` is pure event recording — all functions call `appendRecord()` and return void
- `lineage_tracker.js` is read-only analysis — `buildLineageGraph()` returns data, never initiates actions

**Drift detection**:
```bash
# Check for unauthorized imports
rg -n "require\(" survivability-modules/ --include "*.js" | grep -E "axios|fetch|child_process|net"
# Expected: no results
```

### 2.2 Observability → Execution Control

**Risk**: Telemetry hooks could be elevated from passive recording to active interception/modification.

**Mitigations**:
- `telemetry_emitter.js` exports pure functions — no Express middleware, no `app.use()` calls
- `trace_collector.js` emits spans without injecting tracing headers into HTTP requests
- `replay_hooks.js` provides *exported callback functions* — they must be called explicitly by the Bridge service; they do not self-register

**Drift detection**:
```bash
# Check for middleware registration
rg -n "app\.use\|app\.post\|app\.get\|app\.put\|app\.delete" survivability-modules/ --include "*.js"
# Expected: no results
```

### 2.3 Reconstruction → Governance Engine

**Risk**: Verification results could be used to autonomously quarantine, delete, or modify records.

**Mitigations**:
- `corruption_detector.isolateCorruptedTrace()` returns a report object — it does NOT delete or modify records
- `verification_flow.runFullVerification()` returns a summary — it does NOT enforce any action
- `reconstruction.reconstructTrace()` is a read-only query

**Drift detection**:
```bash
# Check for write operations in reconstruction modules
rg -n "writeFile\|appendFile\|delete\|remove\|unlink" reconstruction/ --include "*.js"
# Expected: no results
```

### 2.4 Survivability Tests → Runtime Monitoring

**Risk**: Test scenarios could be repurposed as production health checks that influence routing.

**Mitigations**:
- `test_suite.js` is a standalone script — it is not imported by any service
- Test functions are `async` with no side effects that persist after test completion
- The `--proof` flag generates a JSON file (passive output) — not a control signal

---

## 3. Drift Timeline

| Risk | Likelihood | Impact | Detection | Mitigation |
|---|---|---|---|---|
| Persistence → Orchestration | Low | Critical | CI import check | No HTTP deps |
| Observability → Control | Low | High | CI middleware check | No self-registration |
| Reconstruction → Governance | Low | Medium | CI write-op check | Read-only by design |
| Tests → Monitoring | Low | Low | CI import check | Standalone only |

---

## 4. Anti-Drift Measures

### 4.1 Automated CI Checks

Every module ships with its own drift-detection tests:

```bash
# Check import graph — no unauthorized dependencies
node -e "
  const deps = require('./replay_persistence/package.json').dependencies || {};
  const forbidden = ['axios', 'express', 'node-fetch', 'child_process'];
  const violations = forbidden.filter(f => deps[f]);
  if (violations.length) throw new Error('Forbidden deps: ' + violations);
  console.log('PASS: No forbidden dependencies');
"
```

### 4.2 Boundary Assertions

Each module includes self-asserting boundary tests:

| Module | Assertion | Enforcement |
|---|---|---|
| `append_only_store.js` | No write modification | `fs.appendFileSync` only |
| `telemetry_emitter.js` | All events tagged `passive: true` | Payload field check |
| `reconstruction_tool.js` | Zero side effects | No `fs.writeFile` calls |
| `corruption_detector.js` | Returns findings, not actions | Return type check |

### 4.3 Manual Review Points

During code review, verify:
1. `require()` statements do not include HTTP or networking libraries
2. No exported function accepts `req`/`res` Express objects
3. No module registers itself as middleware (`app.use()`, `app.METHOD()`)
4. All `appendRecord()` calls are for telemetry/continuity, not execution triggering

---

## 5. Current Drift Assessment

**Date**: 2026-05-17
**Version**: v1.0

| Module | Drift Status | Notes |
|---|---|---|
| `replay_persistence/` | NONE | All append-only, no execution |
| `replay_reconstruction/` | NONE | All read-only verification |
| `observability/` | NONE | All passive telemetry |
| `survivability_tests/` | NONE | Standalone test scripts |

**Overall**: No drift detected. All modules remain within their constitutional boundaries.
