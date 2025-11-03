@echo off
chcp 65001 >nul
setlocal

echo.
echo ═══════════════════════════════════════════════════════════════
echo   📢 BROADCAST ANNOUNCEMENT TO ALL USERS
echo ═══════════════════════════════════════════════════════════════
echo.
echo This will send a message to everyone currently using the app.
echo The message appears in a purple modal that they must dismiss.
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
    "$confirm = Read-Host 'Send this to ALL users? (y/n)'; " ^
    "if ($confirm -ne 'y') { " ^
    "    Write-Host 'Cancelled.' -ForegroundColor Red; " ^
    "    pause; " ^
    "    exit; " ^
    "}; " ^
    "Write-Host ''; " ^
    "Write-Host 'Sending...' -ForegroundColor Yellow; " ^
    "try { " ^
    "    $secretFile = Join-Path $PSScriptRoot 'broadcast-secret.txt'; " ^
    "    if (-not (Test-Path $secretFile)) { " ^
    "        Write-Host ''; " ^
    "        Write-Host '❌ ERROR: Secret file not found!' -ForegroundColor Red; " ^
    "        Write-Host ''; " ^
    "        Write-Host 'Please create: tools/scripts/broadcast-secret.txt' -ForegroundColor Yellow; " ^
    "        Write-Host 'Put your BROADCAST_SECRET on the first line (no quotes)' -ForegroundColor Yellow; " ^
    "        Write-Host ''; " ^
    "        pause; " ^
    "        exit; " ^
    "    }; " ^
    "    $secret = (Get-Content $secretFile -TotalCount 1).Trim(); " ^
    "    if ([string]::IsNullOrWhiteSpace($secret)) { " ^
    "        Write-Host ''; " ^
    "        Write-Host '❌ ERROR: Secret file is empty!' -ForegroundColor Red; " ^
    "        pause; " ^
    "        exit; " ^
    "    }; " ^
    "    $body = @{ message = $message; secret = $secret } | ConvertTo-Json; " ^
    "    $response = Invoke-RestMethod -Uri 'https://wordftw.onrender.com/api/v1/broadcast-announcement' -Method Post -Body $body -ContentType 'application/json'; " ^
    "    Write-Host ''; " ^
    "    Write-Host '✅ SUCCESS! Message broadcasted to all users!' -ForegroundColor Green; " ^
    "    Write-Host ('Recipients: ' + $response.recipients) -ForegroundColor Green; " ^
    "    Write-Host ('Announcement ID: ' + $response.announcementId) -ForegroundColor Gray; " ^
    "    Write-Host ''; " ^
    "} catch { " ^
    "    Write-Host ''; " ^
    "    Write-Host '❌ ERROR: Failed to send broadcast' -ForegroundColor Red; " ^
    "    Write-Host $_.Exception.Message -ForegroundColor Red; " ^
    "    Write-Host ''; " ^
    "}; " ^
    "Write-Host 'Press any key to exit...'; " ^
    "$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')"

exit /b


