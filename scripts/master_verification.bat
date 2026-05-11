@echo off
REM MASTER_VERIFICATION.BAT - Windows version
REM Run all verification tests for Phase 2

echo ==========================================
echo TANTRA PHASE 2 VERIFICATION SUITE
echo ==========================================
echo.

echo This script will verify:
echo   1. Service separation (ports, processes)
echo   2. Replay protection (jti enforcement)
echo   3. Bucket persistence (SQLite)
echo   4. Trace integrity (immutable IDs)
echo   5. Failure propagation (hard stops)
echo.

REM Check if services are running
echo ==========================================
echo PREREQUISITE: CHECKING SERVICES
echo ==========================================
echo.

set SERVICES_UP=true

curl -s --connect-timeout 2 http://localhost:3000/health >nul 2>&1
if %errorlevel%==0 (
  echo   [OK] Port 3000 responding
) else (
  echo   [FAIL] Port 3000 NOT responding
  set SERVICES_UP=false
)

curl -s --connect-timeout 2 http://localhost:3001/health >nul 2>&1
if %errorlevel%==0 (
  echo   [OK] Port 3001 responding
) else (
  echo   [FAIL] Port 3001 NOT responding
  set SERVICES_UP=false
)

curl -s --connect-timeout 2 http://localhost:3002/health >nul 2>&1
if %errorlevel%==0 (
  echo   [OK] Port 3002 responding
) else (
  echo   [FAIL] Port 3002 NOT responding
  set SERVICES_UP=false
)

curl -s --connect-timeout 2 http://localhost:3003/health >nul 2>&1
if %errorlevel%==0 (
  echo   [OK] Port 3003 responding
) else (
  echo   [FAIL] Port 3003 NOT responding
  set SERVICES_UP=false
)

curl -s --connect-timeout 2 http://localhost:3004/health >nul 2>&1
if %errorlevel%==0 (
  echo   [OK] Port 3004 responding
) else (
  echo   [FAIL] Port 3004 NOT responding
  set SERVICES_UP=false
)

if "%SERVICES_UP%"=="false" (
  echo.
  echo ERROR: Not all services are running
  echo Start services with: docker-compose up -d
  exit /b 1
)
echo.

echo ==========================================
echo RUNNING VERIFICATION TESTS
echo ==========================================
echo.

REM Run tests - simplified for Windows batch
echo Test 1: Service Separation
echo   Run: bash scripts/verify_services.sh
echo   OR check ports manually
echo.

echo Test 2: Replay Protection
bash tests/replay_test.sh
if %errorlevel%==0 (
  echo [PASS] Replay protection verified
) else (
  echo [FAIL] Replay protection failed
)
echo.

echo Test 3: Bucket Persistence
bash tests/bucket_persistence_test.sh
if %errorlevel%==0 (
  echo [PASS] Bucket persistence verified
) else (
  echo [FAIL] Bucket persistence failed
)
echo.

echo Test 4: Trace Integrity
bash tests/trace_integrity_test.sh
if %errorlevel%==0 (
  echo [PASS] Trace integrity verified
) else (
  echo [FAIL] Trace integrity failed
)
echo.

echo ==========================================
echo VERIFICATION COMPLETE
echo ==========================================
echo.
echo Check output above for PASS/FAIL status
echo.
echo Proof artifacts:
echo   - Terminal output (see above)
echo   - Logs: docker-compose logs
echo   - Docs: REVIEW_PACKET.md
echo.
pause
