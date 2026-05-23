@echo off
cd /d "%~dp0"
for /f "tokens=*" %%i in (.env) do set %%i
node app.js
