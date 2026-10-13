@echo off
setlocal
cd /d "%~dp0"
echo Deploying CaseMate backend to Supabase project cvsjenanqqmkepmcvdhu.
call npx.cmd --yes supabase login
if errorlevel 1 goto failed
call npx.cmd --yes supabase functions deploy make-server-ba71e98d --project-ref cvsjenanqqmkepmcvdhu --use-api
if errorlevel 1 goto failed
echo Deployment finished successfully.
pause
exit /b 0
:failed
echo Deployment did not finish. See the error above.
pause
exit /b 1
