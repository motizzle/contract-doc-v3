# Simple factory reset test
param([string]$Preset = "empty")

Write-Host "Testing Factory Reset: $Preset" -ForegroundColor Cyan
Write-Host ""

# Trigger reset
$body = @{
    preset = $Preset
    userId = "test-user"
    platform = "web"
} | ConvertTo-Json

$response = Invoke-WebRequest `
    -Uri "https://localhost:4001/api/v1/factory-reset" `
    -Method POST `
    -Body $body `
    -ContentType "application/json" `
    -UseBasicParsing `
    -ErrorAction Stop

Write-Host "Reset Response: $($response.StatusCode)" -ForegroundColor Green
Write-Host ""

# Wait a moment for files to settle
Start-Sleep -Seconds 1

# Check file system
Write-Host "Checking data files:" -ForegroundColor Cyan

$dataAppDir = "data\app"
$files = @(
    "state.json",
    "activity-log.json", 
    "messages.json",
    "chat.json",
    "fields.json",
    "variables.json",
    "approvals.json"
)

foreach ($file in $files) {
    $path = Join-Path $dataAppDir $file
    if (Test-Path $path) {
        $size = (Get-Item $path).Length
        $content = Get-Content $path -Raw | ConvertFrom-Json
        
        $info = ""
        if ($content -is [Array]) {
            $info = "($($content.Count) items)"
        } elseif ($content.PSObject.Properties.Name -contains 'messages') {
            $info = "($($content.messages.Count) messages, $($content.posts.Count) posts)"
        } elseif ($content.PSObject.Properties.Name -contains 'approvers') {
            $info = "($($content.approvers.Count) approvers)"
        } elseif ($content.PSObject.Properties.Name -contains 'title') {
            $info = "(title: $($content.title), v$($content.documentVersion), status: $($content.status))"
        } elseif ($file -eq 'chat.json') {
            $userCount = ($content.PSObject.Properties.Name).Count
            $info = "($userCount users)"
        }
        
        Write-Host "  [OK] $file - $size bytes $info" -ForegroundColor Gray
    } else {
        Write-Host "  [MISSING] $file" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Working document:" -ForegroundColor Cyan
$workingDoc = "data\working\documents\default.docx"
if (Test-Path $workingDoc) {
    $size = (Get-Item $workingDoc).Length
    Write-Host "  [OK] default.docx - $size bytes" -ForegroundColor Gray
} else {
    Write-Host "  [MISSING] default.docx (will use canonical)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Versions:" -ForegroundColor Cyan
$versionsDir = "data\working\versions"
if (Test-Path $versionsDir) {
    $versions = Get-ChildItem $versionsDir -Filter "*.docx"
    if ($versions.Count -gt 0) {
        Write-Host "  [OK] $($versions.Count) version(s)" -ForegroundColor Gray
        foreach ($v in $versions) {
            Write-Host "    - $($v.Name)" -ForegroundColor DarkGray
        }
    } else {
        Write-Host "  [INFO] 0 versions" -ForegroundColor Gray
    }
} else {
    Write-Host "  [INFO] No versions directory" -ForegroundColor Gray
}

Write-Host ""
Write-Host "[SUCCESS] Test complete!" -ForegroundColor Green

