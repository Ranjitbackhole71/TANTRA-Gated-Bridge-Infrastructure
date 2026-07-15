# INSIGHTFLOW_STATUS.md

## Verdict

**OPERATIONAL**

## Startup Evidence

- **Process PID**: 15416
- **Port**: 3005 (LISTENING)
- **stdout**: Server started successfully (current instance responding)
- **stderr (historical)**: EADDRINUSE from a prior failed launch attempt; current process is healthy
- **exit code**: N/A (process is running)
- **startup exception**: None on the active instance

## Verification Results

| Check               | Result | Detail                                          |
|----------------------|--------|-------------------------------------------------|
| /health              | PASS   | `{"service":"insightflow-local","status":"healthy","port":3005}` |
| Telemetry POST       | PASS   | HTTP 201, `{"received":true}`                    |
| Telemetry Retrieval  | PASS   | Correct trace_id returned with full event data   |

## Root Cause of Prior Failure

The `stderr.txt` and `receiver_error.log` contained an `EADDRINUSE` error from a **previous** startup attempt where another instance already held port 3005. The currently running process (PID 15416) was started correctly and is fully operational.
