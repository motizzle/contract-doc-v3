param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("empty", "nearly-done", "initial-vendor")]
    [string]$PresetName
)

Write-Host "📸 Capturing current state as preset: $PresetName" -ForegroundColor Cyan
Write-Host ""

$presetDir = "data\app\presets\$PresetName"

# Copy state files
Write-Host "📄 Copying state files..." -ForegroundColor Yellow
Copy-Item "data\app\state.json" "$presetDir\state.json" -Force
Copy-Item "data\app\activity-log.json" "$presetDir\activity-log.json" -Force
Copy-Item "data\app\messages.json" "$presetDir\messages.json" -Force
Copy-Item "data\app\fields.json" "$presetDir\fields.json" -Force
Copy-Item "data\app\variables.json" "$presetDir\variables.json" -Force

# Copy working document if it exists
if (Test-Path "data\working\documents\default.docx") {
    Write-Host "📝 Copying working document..." -ForegroundColor Yellow
    Copy-Item "data\working\documents\default.docx" "$presetDir\default.docx" -Force
} else {
    Write-Host "ℹ️  No working document found - will use canonical default.docx" -ForegroundColor Gray
}

# Copy version snapshots
Write-Host "🗂️  Copying version snapshots..." -ForegroundColor Yellow
if (-not (Test-Path "$presetDir\versions")) {
    New-Item -ItemType Directory -Path "$presetDir\versions" -Force | Out-Null
}
Remove-Item "$presetDir\versions\*" -Force -ErrorAction SilentlyContinue
if (Test-Path "data\working\versions\*") {
    Copy-Item "data\working\versions\*" "$presetDir\versions\" -Force
    $versionCount = (Get-ChildItem "$presetDir\versions" -Filter "*.docx").Count
    Write-Host "✅ Copied $versionCount version snapshot(s)" -ForegroundColor Green
} else {
    Write-Host "ℹ️  No version snapshots found" -ForegroundColor Gray
}

Write-Host ""
Write-Host "✅ Preset '$PresetName' captured successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Summary:" -ForegroundColor Cyan
$files = Get-ChildItem $presetDir -Recurse -File | Select-Object Name, Length
$files | Format-Table -AutoSize

