@echo off
setlocal

echo Setting up LLM environment variables...
set LLM_PROVIDER=ollama
set OLLAMA_MODEL=gemma3:1b
set OLLAMA_BASE_URL=http://localhost:11434

echo Environment configured:
echo   LLM_PROVIDER=%LLM_PROVIDER%
echo   OLLAMA_MODEL=%OLLAMA_MODEL%
echo   OLLAMA_BASE_URL=%OLLAMA_BASE_URL%
echo.

set SCRIPT_DIR=%~dp0
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%servers.ps1" -Action start
echo.
echo To sideload the Word add-in, run:
echo powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%servers.ps1" -Action sideload
echo.
echo (Press any key to close this window)
pause >nul


