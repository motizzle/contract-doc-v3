param(
    [Parameter(Mandatory=$true)]
    [string]$PresetName
)

$ErrorActionPreference = "Stop"

# Paths
$rootDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$dataAppDir = Join-Path $rootDir "data\app"
$workingDir = Join-Path $rootDir "data\working"
$presetDir = Join-Path $dataAppDir "presets\$PresetName"

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Capturing Preset: $PresetName" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Validate source directories exist
if (-not (Test-Path $dataAppDir)) {
    Write-Error "Source directory not found: $dataAppDir"
    exit 1
}

if (-not (Test-Path $workingDir)) {
    Write-Error "Source directory not found: $workingDir"
    exit 1
}

# Create preset directory if it doesn't exist
if (-not (Test-Path $presetDir)) {
    Write-Host "Creating preset directory: $presetDir" -ForegroundColor Yellow
    New-Item -Path $presetDir -ItemType Directory -Force | Out-Null
} else {
    Write-Host "Preset directory exists, will overwrite: $presetDir" -ForegroundColor Yellow
}

Write-Host ""

# Files to copy from data/app
$appFiles = @(
    "state.json",
    "activity-log.json",
    "messages.json",
    "chat.json",
    "fields.json",
    "variables.json",
    "approvals.json"
)

Write-Host "Copying app data files..." -ForegroundColor Green
$copiedFiles = @()
$skippedFiles = @()

foreach ($file in $appFiles) {
    $sourcePath = Join-Path $dataAppDir $file
    $destPath = Join-Path $presetDir $file
    
    if (Test-Path $sourcePath) {
        Copy-Item -Path $sourcePath -Destination $destPath -Force
        $fileSize = (Get-Item $sourcePath).Length
        Write-Host "  [OK] $file ($fileSize bytes)" -ForegroundColor Gray
        $copiedFiles += $file
    } else {
        Write-Host "  [SKIP] $file (not found, skipped)" -ForegroundColor DarkGray
        $skippedFiles += $file
    }
}

Write-Host ""

# Copy working document
Write-Host "Copying working document..." -ForegroundColor Green
$workingDoc = Join-Path $workingDir "documents\default.docx"
if (Test-Path $workingDoc) {
    $destDoc = Join-Path $presetDir "default.docx"
    Copy-Item -Path $workingDoc -Destination $destDoc -Force
    $fileSize = (Get-Item $workingDoc).Length
    Write-Host "  [OK] default.docx ($fileSize bytes)" -ForegroundColor Gray
    $copiedFiles += "default.docx"
} else {
    Write-Host "  [SKIP] default.docx (not found, skipped)" -ForegroundColor DarkGray
    $skippedFiles += "default.docx"
}

Write-Host ""

# Copy version snapshots
Write-Host "Copying version snapshots..." -ForegroundColor Green
$versionsDir = Join-Path $workingDir "versions"
$presetVersionsDir = Join-Path $presetDir "versions"

if (Test-Path $versionsDir) {
    # Create versions directory in preset
    if (-not (Test-Path $presetVersionsDir)) {
        New-Item -Path $presetVersionsDir -ItemType Directory -Force | Out-Null
    } else {
        # Clear existing versions in preset
        Remove-Item -Path "$presetVersionsDir\*" -Force -ErrorAction SilentlyContinue
    }
    
    # Copy all version files (.docx and .json)
    $versionFiles = Get-ChildItem -Path $versionsDir -File
    if ($versionFiles.Count -gt 0) {
        foreach ($versionFile in $versionFiles) {
            Copy-Item -Path $versionFile.FullName -Destination $presetVersionsDir -Force
            Write-Host "  [OK] versions\$($versionFile.Name) ($($versionFile.Length) bytes)" -ForegroundColor Gray
            $copiedFiles += "versions\$($versionFile.Name)"
        }
    } else {
        Write-Host "  [SKIP] No version files found" -ForegroundColor DarkGray
    }
} else {
    Write-Host "  [SKIP] versions directory not found, skipped" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Capture Summary" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Preset: $PresetName" -ForegroundColor White
Write-Host "Location: $presetDir" -ForegroundColor White
Write-Host ""
Write-Host "Files Copied: $($copiedFiles.Count)" -ForegroundColor Green
if ($skippedFiles.Count -gt 0) {
    Write-Host "Files Skipped: $($skippedFiles.Count)" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "[SUCCESS] Preset captured successfully!" -ForegroundColor Green
Write-Host ""
