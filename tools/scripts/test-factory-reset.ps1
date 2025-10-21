param(
    [string]$ServerUrl = "https://localhost:4001",
    [string]$Preset = "nearly-done"
)

$ErrorActionPreference = "Stop"

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Factory Reset Test" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Server: $ServerUrl" -ForegroundColor White
Write-Host "Preset: $Preset" -ForegroundColor White
Write-Host ""

# Function to call API
function Invoke-API {
    param($Endpoint, $Method = "GET", $Body = $null)
    
    try {
        $params = @{
            Uri = "$ServerUrl$Endpoint"
            Method = $Method
            ContentType = "application/json"
            SkipCertificateCheck = $true
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Compress)
        }
        
        $response = Invoke-RestMethod @params
        return $response
    } catch {
        Write-Host "  [ERROR] API call failed: $Endpoint" -ForegroundColor Red
        Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# Function to test a specific endpoint
function Test-Endpoint {
    param($Name, $Endpoint, $ExpectedCount = $null, $ExpectedProperty = $null)
    
    Write-Host "Testing $Name..." -ForegroundColor Green
    $result = Invoke-API -Endpoint $Endpoint
    
    if ($null -eq $result) {
        Write-Host "  [FAIL] No response" -ForegroundColor Red
        return $false
    }
    
    if ($ExpectedCount -ne $null) {
        $actualCount = 0
        if ($result -is [Array]) {
            $actualCount = $result.Count
        } elseif ($result.PSObject.Properties.Name -contains 'Count') {
            $actualCount = $result.Count
        } elseif ($result.PSObject.Properties.Name -contains 'Length') {
            $actualCount = $result.Length
        }
        
        Write-Host "  [INFO] Count: $actualCount (expected: $ExpectedCount)" -ForegroundColor Gray
        if ($actualCount -ne $ExpectedCount) {
            Write-Host "  [WARN] Count mismatch!" -ForegroundColor Yellow
        }
    }
    
    if ($ExpectedProperty) {
        $value = $result.$ExpectedProperty
        Write-Host "  [INFO] $ExpectedProperty = $value" -ForegroundColor Gray
    }
    
    Write-Host "  [PASS]" -ForegroundColor Green
    return $true
}

# Step 1: Trigger factory reset
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Step 1: Trigger Factory Reset" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$resetResult = Invoke-API -Endpoint "/api/v1/factory-reset?preset=$Preset" -Method "POST" -Body @{ preset = $Preset; userId = "test-user" }

if ($null -eq $resetResult) {
    Write-Host "[FAIL] Factory reset failed!" -ForegroundColor Red
    exit 1
}

Write-Host "[SUCCESS] Factory reset completed" -ForegroundColor Green
Write-Host ""

# Wait for server to settle
Start-Sleep -Seconds 2

# Step 2: Test all endpoints
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Step 2: Verify Data" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$tests = @(
    @{ Name = "State"; Endpoint = "/api/v1/state"; ExpectedProperty = "title" },
    @{ Name = "Activity Log"; Endpoint = "/api/v1/activity"; ExpectedProperty = $null },
    @{ Name = "Messages"; Endpoint = "/api/v1/messages"; ExpectedProperty = $null },
    @{ Name = "Fields"; Endpoint = "/api/v1/fields"; ExpectedProperty = $null },
    @{ Name = "Variables"; Endpoint = "/api/v1/variables"; ExpectedProperty = $null },
    @{ Name = "Approvals"; Endpoint = "/api/v1/approvals"; ExpectedProperty = $null },
    @{ Name = "Versions"; Endpoint = "/api/v1/versions"; ExpectedProperty = $null }
)

$passedTests = 0
$failedTests = 0

foreach ($test in $tests) {
    $result = Test-Endpoint -Name $test.Name -Endpoint $test.Endpoint -ExpectedProperty $test.ExpectedProperty
    if ($result) {
        $passedTests++
    } else {
        $failedTests++
    }
    Write-Host ""
}

# Step 3: Summary
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Preset: $Preset" -ForegroundColor White
Write-Host "Passed: $passedTests" -ForegroundColor Green
Write-Host "Failed: $failedTests" -ForegroundColor $(if ($failedTests -gt 0) { "Red" } else { "Green" })
Write-Host ""

if ($failedTests -eq 0) {
    Write-Host "[SUCCESS] All tests passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "[FAIL] Some tests failed!" -ForegroundColor Red
    exit 1
}

