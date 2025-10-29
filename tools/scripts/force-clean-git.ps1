# Force clean git state without file deletion prompts

Write-Host "Cleaning git state..."

# Remove rebase state directories
if (Test-Path .git/rebase-merge) { 
    Remove-Item -Recurse -Force .git/rebase-merge -ErrorAction SilentlyContinue
}
if (Test-Path .git/rebase-apply) { 
    Remove-Item -Recurse -Force .git/rebase-apply -ErrorAction SilentlyContinue
}

# Reset to clean state
git reset --hard HEAD 2>&1 | Out-Null

# Skip fsmonitor/index hooks that might lock files
git config core.fsmonitor false
git config core.untrackedCache false

# Force update index to ignore locked files
$env:GIT_OPTIONAL_LOCKS = "0"

Write-Host "Git state cleaned. Current status:"
git status

