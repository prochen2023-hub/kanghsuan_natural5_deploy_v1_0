@echo off
setlocal
cd /d "%~dp0"
call VERIFY_DEPLOY.bat || exit /b 1
where git >nul 2>nul || (echo Git not found & exit /b 1)
git add -A
git commit -m "deploy: natural5 kanghsuan v1.1 rich content games school-style exams"
if errorlevel 1 echo [INFO] Nothing new to commit, or commit failed. Check git status.
git push origin HEAD
