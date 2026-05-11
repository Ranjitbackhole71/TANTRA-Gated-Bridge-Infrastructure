# AUDIT: Trace Integrity

## trace_id Consistency

Verified across a full workflow execution:

| Service | trace_id | execution_id | Match? |
|---------|----------|-------------|--------|
| Core (initiate response) | d2aab052-7cc1-4e98-a96d-a31b90b3359f | 6019f8e1-17fd-400d-bf83-c1f8f7a4e738 | ✅ |
| Bridge (intermediate) | d2aab052-7cc1-4e98-a96d-a31b90b3359f | 6019f8e1-17fd-400d-bf83-c1f8f7a4e738 | ✅ |
| Execution (result) | d2aab052-7cc1-4e98-a96d-a31b90b3359f | 6019f8e1-17fd-400d-bf83-c1f8f7a4e738 | ✅ |
| Bucket (retrieved) | d2aab052-7cc1-4e98-a96d-a31b90b3359f | 6019f8e1-17fd-400d-bf83-c1f8f7a4e738 | ✅ |

## Immutability Enforcement Points

| Service | Enforcement | Method |
|---------|------------|--------|
| Core | Generates IDs once | crypto.randomUUID() at core/app.js:32-33 |
| Sarathi | Embeds IDs in JWT | token claims at sarathi/app.js:75-76 |
| Bridge | Compares token vs body | enforceImmutableIds at bridge/app.js:109-130 |
| Execution | Compares token vs body | enforceImmutableIds at execution/app.js:69-81 |
| Bucket | Stores IDs as-is | bucket/app.js:47-52 |

## Mutation Detection Test

```
Token trace_id: "id-test-1"
Body trace_id:   "DIFFERENT-TRACE"

Response: 400 {"error":"trace_id mutation forbidden"}
```

✅ Confirmed: ID mutation is detected and blocked at Bridge with 400.

## ID Propagation in JWT

The JWT token embeds trace_id and execution_id as standard claims:
```json
{
  "trace_id": "immutable-uuid",
  "execution_id": "immutable-uuid",
  "iss": "tantra-sarathi",
  "aud": "tantra-bridge",
  "jti": "unique-id"
}
```

These IDs are signed into the JWT payload, making them tamper-proof (signature would fail if modified).

## Log Traceability

All services log trace_id and execution_id in every structured log message:
```json
{"timestamp":"...","trace_id":"d2aab052-...","execution_id":"6019f8e1-...","service_name":"core","status":"info","message":"..."}
```

## ⚠ Weaknesses

1. **No distributed tracing span**: trace_id is used for request correlation but there is no parent/child span hierarchy or timing correlation
2. **No propagation via headers**: IDs are passed in request body, not HTTP headers (which is non-standard for distributed tracing)
3. **No trace_id on health logs**: Health endpoints log with null trace_id (acceptable for health checks)
4. **No end-to-end trace visualization**: No Jaeger/Zipkin integration

## Verdict: ✅ Trace integrity is enforced

trace_id and execution_id remain immutable across all 5 services. The JWT signature protects the IDs from tampering. Each service validates that the body IDs match the token IDs. The enforcement is verifiable and working.
