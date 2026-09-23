# Complete live runtime certification

## Repository

- Repository: `C:\Users\Ranjit\bhiv-Gurukul\TANTRA-Gated-Bridge-Infrastructure`
- Commit: `b67158734ba874df4e4b25a27097cf2fd1405db6`
- Verification run: `2026-09-23`, started `14:24:58 +05:30`
- Certification trace: `9edb53c3-7fa4-4807-b281-faaa0dbdd6c0`
- Certification execution: `481cbee3-7922-45c8-8ff6-b44d61b83b01`

## Configuration confirmation

The only intended configuration diff is:

```yaml
- INSIGHTFLOW_URL=${INSIGHTFLOW_URL}
+ INSIGHTFLOW_URL=${INSIGHTFLOW_URL:-http://tantra-insightflow:3005}
```

`git status` also showed a pre-existing `.gitignore` modification; it was not changed during this run.

## Checks performed and results

1. All required health endpoints: PASS, HTTP 200.
2. Authorized Core execution: PASS, HTTP 200, completed.
3. `trace_id` continuity: PASS.
4. `execution_id` continuity: PASS.
5. Valid authentication: PASS, HTTP 200.
6. Invalid authentication: PASS, HTTP 401.
7. JTI replay rejection: PASS, HTTP 401.
8. JTI replay after Bridge restart: PASS, first request 200 and replay 401.
9. `trace_id` mutation rejection: PASS, HTTP 400.
10. `execution_id` mutation rejection: PASS, HTTP 400.
11. CET/hash mismatch rejection: PASS, HTTP 400.
12. Bucket downstream failure: PASS, Bridge returned HTTP 503 while Bucket was stopped.
13. Bucket restart/readiness: PASS, HTTP 200.
14. Artifact creation: PASS.
15. Artifact retrieval: PASS.
16. SHA-256/read-after-write: PASS; `verified=true`, `persistent=true`, IDs and hashes matched.
17. Replay persistence: PASS; persisted replay log contained certification records and restart replay remained rejected.
18. Replay chain integrity: PASS; 54 records, valid, zero errors.
19. Replay reconstruction: PASS; 5-record certification chain reconstructed.
20. InsightFlow emission: PASS; current Core-generated trace had 3 real events.
21. `GET /telemetry`: PASS, HTTP 200, 26 total events.
22. `GET /telemetry/summary`: PASS, HTTP 200, 26 events across 10 traces.
23. `GET /telemetry/:traceId`: PASS, HTTP 200, current Core-generated trace count 3.

## Evidence files

- `health.md`
- `execution.json`
- `security-negative-results.json`
- `bucket-hash.json`
- `replay-integrity.json`
- `reconstruction.json`
- `telemetry.json`
- `SUMMARY.md`

## Limitations

The repository Bash scripts were not used because Bash/WSL is unavailable. Equivalent PowerShell, Docker, and Node runtime checks were executed directly. No source code, tests, or mock telemetry were changed or inserted.

## Overall certification

**PASS — complete live runtime certification.**
