@echo off
setlocal
cd /d "%~dp0"
echo [Natural5] Checking deploy files...
set FAIL=0
for %%F in (index.html styles.css data.js app.js manifest.webmanifest sw.js 404.html VERSION .nojekyll) do (
  if not exist "%%F" (
    echo [FAIL] missing %%F
    set FAIL=1
  ) else (
    echo [OK] %%F
  )
)
if not exist "assets\icon.svg" (
  echo [FAIL] missing assets\icon.svg
  set FAIL=1
) else echo [OK] assets\icon.svg
where node >nul 2>nul
if %errorlevel%==0 (
  node --check app.js || set FAIL=1
  node --check data.js || set FAIL=1
  node --check sw.js || set FAIL=1
  if exist "qa_v20.js" node qa_v20.js || set FAIL=1
) else (
  echo [INFO] Node.js not installed; skipped JavaScript syntax check.
)
if "%FAIL%"=="1" (
  echo.
  echo VERIFY FAILED
  exit /b 1
)
echo.
echo VERIFY PASS - ready for GitHub Pages.
exit /b 0
