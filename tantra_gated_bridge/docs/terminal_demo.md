# TERMINAL DEMO - Step-by-Step Recording Guide

## Objective
Provide exact terminal commands for recording a live demonstration of TANTRA infrastructure.

---

## Pre-Demo Setup

```bash
# 1. Start all services
cd services
docker-compose up -d

# 2. Verify all services healthy
curl -s http://localhost:3000/health
curl -s http://localhost:3001/health
curl -s http://localhost:3002/health
curl -s http://localhost:3003/health
curl -s http://localhost:3004/health
```

---

## Recording Sequence

### Scene 1: Service Separation Proof

**Terminal 1:** Show directory structure
```bash
tree services/ -L 2
# OR on Windows:
dir /s /b services\ | findstr /R "\.js$ \.json$ Dockerfile"
```

**Terminal 2:** Show running processes
```bash
ps aux | grep "node.*app.js" | grep -v grep
# OR on Windows:
netstat -ano | findstr "3000 3001 3002 3003 3004"
```

**Screenshot Point:** Show 5 different Node processes on 5 different ports

---

### Scene 2: Full Workflow Demo

```bash
# Clear screen
clear

# Run full workflow
curl -X POST http://localhost:3000/initiate \
  -H "Content-Type: application/json" \
  -d '{"workload": "demo-task"}' | jq .
```

**Expected Output:**
```json
{
  "trace_id": "uuid-1",
  "execution_id": "uuid-2",
  "status": "completed",
  "result": {
    "trace_id": "uuid-1",
    "execution_id": "uuid-2",
    "status": "completed",
    ...
  }
}
```

**Screenshot Point:** Show matching trace_id and execution_id across response

---

### Scene 3: Trace Integrity Verification

```bash
# Set variables from previous response
TRACE_ID="<from-previous-response>"
EXEC_ID="<from-previous-response>"

# Verify in Bucket
curl -s http://localhost:3004/retrieve/$TRACE_ID/$EXEC_ID | jq .

# Show they match
echo "Core/Response trace_id: $TRACE_ID"
echo "Bucket trace_id: $(curl -s http://localhost:3004/retrieve/$TRACE_ID/$EXEC_ID | jq -r '.trace_id')"
```

**Screenshot Point:** Show "SAME TRACE VERIFIED" message

---

### Scene 4: Replay Attack Demonstration

```bash
# Get token
TOKEN_RESP=$(curl -s -X POST http://localhost:3001/token \
  -H "Content-Type: application/json" \
  -d '{"trace_id": "replay-demo", "execution_id": "replay-demo-exec"}')
TOKEN=$(echo "$TOKEN_RESP" | jq -r '.token')

echo "Token obtained (first use will succeed)"

# First use - should succeed
curl -X POST http://localhost:3002/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"workload": "demo", "trace_id": "replay-demo", "execution_id": "replay-demo-exec"}' \
  | jq -c .

echo "---"
echo "Now replaying same token (should fail with 401)..."

# Replay - should fail
curl -X POST http://localhost:3002/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"workload": "demo", "trace_id": "replay-demo", "execution_id": "replay-demo-exec"}'
```

**Screenshot Point:** Show 401 Unauthorized with "Token replay detected"

---

### Scene 5: Failure Proof (Sarathi Down)

```bash
echo "Stopping Sarathi service..."
docker-compose stop sarathi

echo "Attempting to initiate workflow..."
curl -X POST http://localhost:3000/initiate \
  -H "Content-Type: application/json" \
  -d '{"workload": "fail-test"}' | jq .

echo "---"
echo "Proof: System BLOCKS when Sarathi unavailable"
echo "No fallback, no degraded mode"

# Restart
docker-compose start sarathi
```

**Screenshot Point:** Show 503 error with "System stopped: dependency unavailable"

---

### Scene 6: Bucket Persistence Proof

```bash
echo "Storing artifact..."
curl -X POST http://localhost:3004/store \
  -H "Content-Type: application/json" \
  -d '{
    "trace_id": "persist-demo",
    "execution_id": "persist-demo-exec",
    "result": {"test": true},
    "timestamp": "'$(date -Iseconds)'",
    "duration_ms": 100
  }' | jq .

echo "---"
echo "Checking SQLite database file exists..."
ls -la bucket/bucket.db

echo "---"
echo "Querying database directly..."
sqlite3 bucket/bucket.db "SELECT trace_id, execution_id, hash FROM artifacts LIMIT 1;"
```

**Screenshot Point:** Show database file and direct SQL query result

---

## Post-Demo Commands

```bash
# Generate all proof artifacts
cd ../scripts
./demo_flow.sh > ../proof/terminal_demo_output.txt

cd ../tests
./replay_test.sh > ../proof/replay_test_output.txt
./trace_integrity_test.sh > ../proof/trace_test_output.txt
./bucket_persistence_test.sh > ../proof/bucket_test_output.txt

# Save logs
cd ../services
docker-compose logs > ../proof/all_services.log
```

---

## Evidence Checklist

- [ ] 5 separate processes on 5 ports
- [ ] Full workflow succeeds
- [ ] trace_id matches across all services
- [ ] execution_id matches across all services
- [ ] Replay attack blocked (401)
- [ ] Sarathi down → BLOCK (503)
- [ ] Bucket persistence verified (SQLite)
- [ ] Structured logs captured
- [ ] Terminal output saved

---

## Recording Tips

1. Use a clean terminal (no sensitive info in prompt)
2. Maximize terminal window
3. Use `jq .` for pretty JSON output
4. Show response times with `time` command
5. Highlight key outputs with echo statements
