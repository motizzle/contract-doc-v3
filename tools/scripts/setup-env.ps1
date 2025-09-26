# PowerShell script to set up LLM environment variables
# Run this before starting servers to ensure proper configuration

Write-Host "Setting up LLM Environment Variables..." -ForegroundColor Green

# Set environment variables
$env:LLM_PROVIDER = "ollama"
$env:OLLAMA_MODEL = "gemma3:1b"
$env:OLLAMA_BASE_URL = "http://localhost:11434"

# Display current configuration
Write-Host "Environment Variables Set:" -ForegroundColor Green
Write-Host "   LLM_PROVIDER: $env:LLM_PROVIDER" -ForegroundColor Yellow
Write-Host "   OLLAMA_MODEL: $env:OLLAMA_MODEL" -ForegroundColor Yellow
Write-Host "   OLLAMA_BASE_URL: $env:OLLAMA_BASE_URL" -ForegroundColor Yellow

Write-Host ""
Write-Host "Ready to start servers!" -ForegroundColor Green
Write-Host "   Run: .\tools\scripts\servers.ps1 -Action start" -ForegroundColor Cyan
Write-Host ""
Write-Host "Tip: Run this script every time you start a new PowerShell session" -ForegroundColor Magenta
