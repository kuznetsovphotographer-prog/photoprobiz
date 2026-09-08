@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-local-network-site.ps1"
set "exit_code=%errorlevel%"
if not "%exit_code%"=="0" (
  echo.
  echo Site launch failed. The error is shown above.
  pause
)
exit /b %exit_code%
