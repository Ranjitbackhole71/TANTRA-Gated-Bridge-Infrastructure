# FINAL DEMO SEQUENCE

## Scene 1: Services Running (30 seconds)
```
Terminal: Show health checks
Output:
  {"service":"core","status":"healthy"}
  {"service":"sarathi","status":"healthy","issuer":"tantra-sarathi"}
  {"service":"bridge","status":"healthy"}
  {"service":"execution","status":"healthy"}
  {"service":"bucket","status":"healthy"}
```

## Scene 2: End-to-End Workflow (30 seconds)
```
curl -X POST http://localhost:3000/initiate -H "Content-Type: application/json" -d '{"workload":"demo-task"}' | jq .

Key output:
  trace_id: bd86c552-...  ← same across response
  execution_id: bdf633a6-... ← same across response
  status: "completed"
  duration_ms: 109
```

## Scene 3: Trace Integrity (20 seconds)
```
curl -s http://localhost:3004/retrieve/<trace_id>/<execution_id> | jq .trace_id
# Output matches the trace_id from Scene 2
```

## Scene 4: Replay Attack Demo (30 seconds)
```
Step 1: curl -X POST localhost:3001/token ...  → get token
Step 2: curl -X POST localhost:3002/execute ...  → 200 completed
Step 3: curl -X POST localhost:3002/execute ...  → 401 "Token replay detected"
```

## Scene 5: Failure Propagation (30 seconds)
```
Invalid token:
  curl -X POST localhost:3002/execute -H "Authorization: Bearer invalid"
  → 401 {"error":"Unauthorized: Invalid token"}

ID mutation:
  curl -X POST localhost:3002/execute -d '{"trace_id":"FAKE",...}'
  → 400 {"error":"trace_id mutation forbidden"}
```

## Scene 6: Bucket Persistence (20 seconds)
```
curl -X POST localhost:3004/store -d '{...}'
→ {"verified":true,"persistent":true,"hash":"f2ecbc9f..."}
```

## Total Demo Time: ~2.5 minutes
