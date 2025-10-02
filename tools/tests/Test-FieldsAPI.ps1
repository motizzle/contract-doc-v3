# Phase 1 Fields API PowerShell Test Script
#
# Tests all Phase 1 field endpoints using PowerShell
#
# Usage:
#   .\tools\tests\Test-FieldsAPI.ps1
#
# Prerequisites:
#   - Server must be running on https://localhost:4001
#   - PowerShell 5.1 or later

$BaseUrl = "https://localhost:4001"
$TestsPassed = 0
$TestsFailed = 0

Write-Host "`n🧪 Starting Phase 1 Fields API Tests`n" -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor Gray

# Helper function to make API requests
function Invoke-ApiRequest {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body = $null
    )
    
    $url = "$BaseUrl$Path"
    $params = @{
        Uri = $url
        Method = $Method
        SkipCertificateCheck = $true
        ErrorAction = 'Stop'
    }
    
    if ($Body) {
        $params.ContentType = 'application/json'
        $params.Body = ($Body | ConvertTo-Json -Depth 10)
    }
    
    try {
        $response = Invoke-RestMethod @params
        return @{ Success = $true; Data = $response; Status = 200 }
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
        return @{ Success = $false; Data = $errorBody; Status = $statusCode; Error = $_.Exception.Message }
    }
}

# Test helper
function Test-Case {
    param(
        [string]$Name,
        [scriptblock]$TestBlock
    )
    
    try {
        & $TestBlock
        Write-Host "✅ $Name" -ForegroundColor Green
        $script:TestsPassed++
    }
    catch {
        Write-Host "❌ $Name" -ForegroundColor Red
        Write-Host "   Error: $_" -ForegroundColor Red
        $script:TestsFailed++
    }
}

# Test 1: Health check
Test-Case "Server is running" {
    $result = Invoke-ApiRequest -Method GET -Path "/api/health"
    if (-not $result.Success) {
        throw "Server not responding"
    }
}

# Test 2: Get all fields (initial)
Test-Case "GET /api/v1/fields - returns fields object" {
    $result = Invoke-ApiRequest -Method GET -Path "/api/v1/fields"
    if (-not $result.Success) {
        throw "Failed with status $($result.Status)"
    }
    if ($null -eq $result.Data.fields) {
        throw "Missing fields property"
    }
}

# Test 3: Create a field
$TestField = @{
    fieldId = "ps-test-001"
    displayLabel = "PowerShell Test Field"
    fieldType = "TEXTINPUT"
    fieldColor = "#980043"
    type = "text"
    category = "PowerShell Tests"
    defaultValue = ""
    userId = "ps-test-user"
}

Test-Case "POST /api/v1/fields - creates new field" {
    $result = Invoke-ApiRequest -Method POST -Path "/api/v1/fields" -Body $TestField
    if (-not $result.Success) {
        throw "Failed with status $($result.Status)"
    }
    if (-not $result.Data.ok -or $null -eq $result.Data.field) {
        throw "Invalid response structure"
    }
    if ($result.Data.field.fieldId -ne $TestField.fieldId) {
        throw "Field ID mismatch"
    }
}

# Test 4: Get all fields (should contain our field)
Test-Case "GET /api/v1/fields - created field exists" {
    $result = Invoke-ApiRequest -Method GET -Path "/api/v1/fields"
    if ($null -eq $result.Data.fields[$TestField.fieldId]) {
        throw "Created field not found"
    }
}

# Test 5: Update field
Test-Case "PUT /api/v1/fields/:fieldId - updates field" {
    $updates = @{
        displayLabel = "Updated PowerShell Test Field"
        category = "Updated Category"
        userId = "ps-test-user"
    }
    $result = Invoke-ApiRequest -Method PUT -Path "/api/v1/fields/$($TestField.fieldId)" -Body $updates
    if (-not $result.Success) {
        throw "Failed with status $($result.Status)"
    }
    if ($result.Data.field.displayLabel -ne $updates.displayLabel) {
        throw "Update not applied"
    }
}

# Test 6: Duplicate field error
Test-Case "POST /api/v1/fields - rejects duplicate fieldId" {
    $result = Invoke-ApiRequest -Method POST -Path "/api/v1/fields" -Body $TestField
    if ($result.Status -ne 409) {
        throw "Expected 409 Conflict, got $($result.Status)"
    }
}

# Test 7: Missing required fields error
Test-Case "POST /api/v1/fields - rejects missing required fields" {
    $invalidField = @{ fieldId = "test" }
    $result = Invoke-ApiRequest -Method POST -Path "/api/v1/fields" -Body $invalidField
    if ($result.Status -ne 400) {
        throw "Expected 400 Bad Request, got $($result.Status)"
    }
}

# Test 8: Non-existent field error
Test-Case "PUT /api/v1/fields/:fieldId - rejects non-existent field" {
    $updates = @{
        displayLabel = "Test"
        userId = "test"
    }
    $result = Invoke-ApiRequest -Method PUT -Path "/api/v1/fields/does-not-exist" -Body $updates
    if ($result.Status -ne 404) {
        throw "Expected 404 Not Found, got $($result.Status)"
    }
}

# Test 9: Create multiple fields
Test-Case "POST /api/v1/fields - creates multiple fields" {
    $field2 = $TestField.Clone()
    $field2.fieldId = "ps-test-002"
    $field2.displayLabel = "Test Field Two"
    
    $field3 = $TestField.Clone()
    $field3.fieldId = "ps-test-003"
    $field3.displayLabel = "Test Field Three"
    
    $result2 = Invoke-ApiRequest -Method POST -Path "/api/v1/fields" -Body $field2
    $result3 = Invoke-ApiRequest -Method POST -Path "/api/v1/fields" -Body $field3
    
    if (-not $result2.Success -or -not $result3.Success) {
        throw "Failed to create multiple fields"
    }
}

# Test 10: Verify all fields
Test-Case "GET /api/v1/fields - returns all created fields" {
    $result = Invoke-ApiRequest -Method GET -Path "/api/v1/fields"
    $fieldCount = ($result.Data.fields.PSObject.Properties | Measure-Object).Count
    if ($fieldCount -lt 3) {
        throw "Expected at least 3 fields, got $fieldCount"
    }
}

# Test 11: Check activity log
Test-Case "GET /api/v1/activity - contains field activities" {
    $result = Invoke-ApiRequest -Method GET -Path "/api/v1/activity"
    if (-not $result.Success) {
        throw "Failed to get activity log"
    }
    $fieldActivities = $result.Data.activities | Where-Object { $_.target -eq 'field' }
    if ($fieldActivities.Count -eq 0) {
        throw "No field activities found"
    }
    Write-Host "   Found $($fieldActivities.Count) field activities in log" -ForegroundColor Gray
}

# Test 12: Delete field
Test-Case "DELETE /api/v1/fields/:fieldId - deletes field" {
    $result = Invoke-ApiRequest -Method DELETE -Path "/api/v1/fields/$($TestField.fieldId)?userId=ps-test-user"
    if (-not $result.Success) {
        throw "Failed with status $($result.Status)"
    }
    if (-not $result.Data.ok) {
        throw "Delete failed"
    }
}

# Test 13: Verify deletion
Test-Case "GET /api/v1/fields - deleted field is removed" {
    $result = Invoke-ApiRequest -Method GET -Path "/api/v1/fields"
    if ($null -ne $result.Data.fields[$TestField.fieldId]) {
        throw "Field still exists after deletion"
    }
}

# Test 14: Cleanup - delete remaining test fields
Test-Case "Cleanup - delete remaining test fields" {
    Invoke-ApiRequest -Method DELETE -Path "/api/v1/fields/ps-test-002?userId=ps-test-user" | Out-Null
    Invoke-ApiRequest -Method DELETE -Path "/api/v1/fields/ps-test-003?userId=ps-test-user" | Out-Null
    
    $result = Invoke-ApiRequest -Method GET -Path "/api/v1/fields"
    $remainingTestFields = $result.Data.fields.PSObject.Properties | 
        Where-Object { $_.Name -like "ps-test-*" }
    
    if ($remainingTestFields.Count -gt 0) {
        throw "$($remainingTestFields.Count) test fields still remaining"
    }
}

# Results
Write-Host ("`n" + ("=" * 60)) -ForegroundColor Gray
Write-Host "`n📊 Test Results:" -ForegroundColor Cyan
Write-Host "   ✅ Passed: $TestsPassed" -ForegroundColor Green
Write-Host "   ❌ Failed: $TestsFailed" -ForegroundColor Red
Write-Host "   📈 Total:  $($TestsPassed + $TestsFailed)" -ForegroundColor Gray

if ($TestsFailed -eq 0) {
    Write-Host "`n🎉 All tests passed! Phase 1 backend is working correctly.`n" -ForegroundColor Green
    exit 0
}
else {
    Write-Host "`n⚠️  Some tests failed. Please review the errors above.`n" -ForegroundColor Yellow
    exit 1
}

