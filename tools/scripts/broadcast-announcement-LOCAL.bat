@echo off
chcp 65001 >nul
setlocal

echo.
echo ═══════════════════════════════════════════════════════════════
echo   📢 BROADCAST ANNOUNCEMENT (LOCAL TEST)
echo ═══════════════════════════════════════════════════════════════
echo.
echo ⚠️  This sends to LOCAL SERVER ONLY (localhost:4001)
echo ⚠️  Safe to test without spamming production users
echo.
echo ───────────────────────────────────────────────────────────────
echo  FORMATTING TIPS:
echo ───────────────────────────────────────────────────────────────
echo.
echo   • Line breaks: Just press Enter for a new line
echo   • Blank lines: Press Enter twice for spacing
echo   • Bullets: Use • - or * at the start of lines
echo   • Emojis: Use emojis like 🚀 🎉 ⚠️ ✅ 🔥 💡
echo   • Sections: Use --- or ═══ as separators
echo   • Emphasis: Use CAPS or **asterisks** (they show as-is)
echo.
echo   Example:
echo     Hey everyone! 🎉
echo.
echo     New features just shipped:
echo     • Approval workflows are faster
echo     • Version comparison fixed
echo.
echo     Refresh to see the updates!
echo.
echo ───────────────────────────────────────────────────────────────
echo.
pause
echo.
echo Enter your message below.
echo When finished, type DONE on a new line and press Enter:
echo.

REM Launch PowerShell to handle multiline input and send request
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$lines = @(); " ^
    "Write-Host ''; " ^
    "while ($true) { " ^
    "    $line = Read-Host; " ^
    "    if ($line -eq 'DONE') { break }; " ^
    "    $lines += $line; " ^
    "}; " ^
    "$message = $lines -join \"`n\"; " ^
    "Write-Host ''; " ^
    "Write-Host '═══════════════════════════════════════════════════════════════' -ForegroundColor Cyan; " ^
    "Write-Host 'MESSAGE PREVIEW:' -ForegroundColor Cyan; " ^
    "Write-Host '═══════════════════════════════════════════════════════════════' -ForegroundColor Cyan; " ^
    "Write-Host $message; " ^
    "Write-Host '═══════════════════════════════════════════════════════════════' -ForegroundColor Cyan; " ^
    "Write-Host ''; " ^
    "$confirm = Read-Host 'Send this to LOCAL SERVER? (y/n)'; " ^
    "if ($confirm -ne 'y') { " ^
    "    Write-Host 'Cancelled.' -ForegroundColor Red; " ^
    "    pause; " ^
    "    exit; " ^
    "}; " ^
    "Write-Host ''; " ^
    "Write-Host 'Sending to https://localhost:4001...' -ForegroundColor Yellow; " ^
    "try { " ^
    "    $secretFile = Join-Path $PSScriptRoot 'broadcast-secret.txt'; " ^
    "    if (-not (Test-Path $secretFile)) { " ^
    "        Write-Host 'No secret file found, using dev default secret...' -ForegroundColor Yellow; " ^
    "        $secret = 'dev-secret-change-in-production-min-32-chars'; " ^
    "    } else { " ^
    "        $secret = (Get-Content $secretFile -TotalCount 1).Trim(); " ^
    "    }; " ^
    "    $body = @{ message = $message; secret = $secret } | ConvertTo-Json; " ^
    "    $response = Invoke-RestMethod -Uri 'https://localhost:4001/api/v1/broadcast-announcement' -Method Post -Body $body -ContentType 'application/json' -SkipCertificateCheck; " ^
    "    Write-Host ''; " ^
    "    Write-Host '✅ SUCCESS! Message broadcasted to LOCAL server!' -ForegroundColor Green; " ^
    "    Write-Host ('Recipients: ' + $response.recipients) -ForegroundColor Green; " ^
    "    Write-Host ('Announcement ID: ' + $response.announcementId) -ForegroundColor Gray; " ^
    "    Write-Host ''; " ^
    "} catch { " ^
    "    Write-Host ''; " ^
    "    Write-Host '❌ ERROR: Failed to send broadcast' -ForegroundColor Red; " ^
    "    Write-Host $_.Exception.Message -ForegroundColor Red; " ^
    "    Write-Host ''; " ^
    "    Write-Host 'Make sure local server is running on https://localhost:4001' -ForegroundColor Yellow; " ^
    "    Write-Host ''; " ^
    "}; " ^
    "Write-Host 'Press any key to exit...'; " ^
    "$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')"

exit /b


