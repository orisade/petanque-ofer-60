@echo off
REM Double-click this file on Windows to build both shareable copies.
cd /d "%~dp0"

echo.
echo ==============================================
echo    Petanque Ofer 60 - building your copies
echo ==============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo !! Node.js is not installed.
  echo    Get it from https://nodejs.org ^(take the LTS version^),
  echo    then double-click this file again.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo First run - installing dependencies ^(one minute or so^)...
  call npm install --silent
  if errorlevel 1 (
    echo !! npm install failed
    pause
    exit /b 1
  )
  echo.
)

echo Building...
call npm run release
if errorlevel 1 (
  echo.
  echo !! Build failed - see the messages above.
  pause
  exit /b 1
)

echo.
echo ==============================================
echo   Done. Both files are in this folder:
echo      Petanque-Ofer-60.html         ^(to PLAY^)
echo      Petanque-Ofer-60-source.zip   ^(to EDIT^)
echo ==============================================
echo.
start "" "%cd%"
pause
