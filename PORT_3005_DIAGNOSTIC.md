# PORT 3005 DIAGNOSTIC

## Status: FREE — No process occupying port 3005

## Original Claim
- Previous session reported PID 22600 on port 3005
- Health endpoint on port 3005 returned 404

## Investigation
- `Get-Process -Id 22600`: **Process does not exist**
- `netstat -ano | Select-String ":3005"`: **No listening socket on port 3005**
- `netstat -ano -p TCP | Select-String ":300"`:
  Port 3000 — PID 7040 (node, Next.js email-management-system)
  Port 3002 — PID 7276 (node app.js, confirmed as TANTRA Bridge)
  Ports 3001, 3003, 3004, 3005 — **NOT listening**

## Conclusion
- PID 22600 terminated (likely a previous crashed InsightFlow instance or unrelated process)
- Port 3005 is fully available for InsightFlow Local Receiver
- **No kill required**

## Active TANTRA Services (as of now)
| Service | Port | PID | Status |
|---------|------|-----|--------|
| Core    | 3000 | 7040 | BLOCKED — occupied by Next.js email app (not TANTRA core) |
| Sarathi | 3001 | — | DOWN |
| Bridge  | 3002 | 7276 | RUNNING (healthy) |
| Execution | 3003 | — | DOWN |
| Bucket  | 3004 | — | DOWN |
| InsightFlow | 3005 | — | FREE |
