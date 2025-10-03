# Test Variables Backend API
# Tests all variable endpoints: GET, POST, PUT (metadata), PUT (value), DELETE

$ErrorActionPreference = "Stop"

# Certificate trust policy for self-signed certs
add-type @"
    using System.Net;
    using System.Security.Cryptography.X509Certificates;
    public class TrustAllCertsPolicy : ICertificatePolicy {
        public bool CheckValidationResult(
            ServicePoint svcPoint, X509Certificate certificate,
            WebRequest request, int certificateProblem) {
            return true;
        }
    }
"@
[System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAllCertsPolicy
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12

$API_BASE = "https://localhost:4001"
$TestUserId = "test-user"

Write-Host "`n=== Variables Backend Test ===" -ForegroundColor Cyan
Write-Host "Testing API at: $API_BASE" -ForegroundColor Gray

# Helper function for API calls
function Invoke-ApiCall {
    param(
        [string]$Method,
        [string]$Uri,
        [object]$Body = $null
    )
    
    $params = @{
        Method = $Method
        Uri = $Uri
        ContentType = "application/json"
        UseBasicParsing = $true
    }
    
    if ($Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 10)
    }
    
    try {
        $response = Invoke-WebRequest @params
        return @{
            Success = $true
            StatusCode = $response.StatusCode
            Data = ($response.Content | ConvertFrom-Json)
        }
    } catch {
        return @{
            Success = $false
            StatusCode = $_.Exception.Response.StatusCode.value__
            Error = $_.Exception.Message
        }
    }
}

# Test 1: Health Check
Write-Host "`n[Test 1] Health Check" -ForegroundColor Yellow
$result = Invoke-ApiCall -Method "GET" -Uri "$API_BASE/api/v1/health"
if ($result.Success -and $result.StatusCode -eq 200) {
    Write-Host "✅ Server is healthy" -ForegroundColor Green
} else {
    Write-Host "❌ Health check failed: $($result.Error)" -ForegroundColor Red
    exit 1
}

# Test 2: GET /api/v1/variables (should return empty or existing variables)
Write-Host "`n[Test 2] GET /api/v1/variables" -ForegroundColor Yellow
$result = Invoke-ApiCall -Method "GET" -Uri "$API_BASE/api/v1/variables"
if ($result.Success -and $result.StatusCode -eq 200) {
    $varCount = ($result.Data.variables | Get-Member -MemberType NoteProperty).Count
    Write-Host "✅ GET variables successful. Found $varCount variable(s)" -ForegroundColor Green
    Write-Host "   Variables: $($result.Data.variables | ConvertTo-Json -Compress)" -ForegroundColor Gray
} else {
    Write-Host "❌ GET variables failed: $($result.Error)" -ForegroundColor Red
    exit 1
}

# Test 3: POST /api/v1/variables (create a value variable)
Write-Host "`n[Test 3] POST /api/v1/variables (create value variable)" -ForegroundColor Yellow
$testVar1 = @{
    displayLabel = "Contract Amount"
    type = "value"
    category = "Financial"
    value = "$1,000,000"
    userId = $TestUserId
}
$result = Invoke-ApiCall -Method "POST" -Uri "$API_BASE/api/v1/variables" -Body $testVar1
if ($result.Success -and $result.StatusCode -eq 200 -and $result.Data.ok) {
    $createdVar1 = $result.Data.variable
    Write-Host "✅ Variable created successfully" -ForegroundColor Green
    Write-Host "   varId: $($createdVar1.varId)" -ForegroundColor Gray
    Write-Host "   displayLabel: $($createdVar1.displayLabel)" -ForegroundColor Gray
    Write-Host "   type: $($createdVar1.type)" -ForegroundColor Gray
    Write-Host "   value: $($createdVar1.value)" -ForegroundColor Gray
    Write-Host "   category: $($createdVar1.category)" -ForegroundColor Gray
} else {
    Write-Host "❌ Create variable failed: $($result.Error)" -ForegroundColor Red
    exit 1
}

# Test 4: POST /api/v1/variables (create a signature variable)
Write-Host "`n[Test 4] POST /api/v1/variables (create signature variable)" -ForegroundColor Yellow
$testVar2 = @{
    displayLabel = "Party A Signature"
    type = "signature"
    category = "Signatures"
    value = ""
    docusignRole = "Signer1"
    userId = $TestUserId
}
$result = Invoke-ApiCall -Method "POST" -Uri "$API_BASE/api/v1/variables" -Body $testVar2
if ($result.Success -and $result.StatusCode -eq 200 -and $result.Data.ok) {
    $createdVar2 = $result.Data.variable
    Write-Host "✅ Signature variable created successfully" -ForegroundColor Green
    Write-Host "   varId: $($createdVar2.varId)" -ForegroundColor Gray
    Write-Host "   displayLabel: $($createdVar2.displayLabel)" -ForegroundColor Gray
    Write-Host "   type: $($createdVar2.type)" -ForegroundColor Gray
    Write-Host "   docusignRole: $($createdVar2.docusignRole)" -ForegroundColor Gray
} else {
    Write-Host "❌ Create signature variable failed: $($result.Error)" -ForegroundColor Red
    exit 1
}

# Test 5: GET /api/v1/variables (verify both variables exist)
Write-Host "`n[Test 5] GET /api/v1/variables (verify created variables)" -ForegroundColor Yellow
$result = Invoke-ApiCall -Method "GET" -Uri "$API_BASE/api/v1/variables"
if ($result.Success -and $result.StatusCode -eq 200) {
    # Check if our test variables exist
    $var1Found = $null
    $var2Found = $null
    
    foreach ($prop in $result.Data.variables.PSObject.Properties) {
        if ($prop.Value.displayLabel -eq "Contract Amount") {
            $var1Found = $prop.Value
        }
        if ($prop.Value.displayLabel -eq "Party A Signature") {
            $var2Found = $prop.Value
        }
    }
    
    if ($var1Found -and $var2Found) {
        Write-Host "✅ Both test variables found in GET response" -ForegroundColor Green
        Write-Host "   Contract Amount: $($var1Found.value)" -ForegroundColor Gray
        Write-Host "   Party A Signature: $($var2Found.type)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Test variables not found in GET response" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ GET variables failed: $($result.Error)" -ForegroundColor Red
    exit 1
}

# Test 6: PUT /api/v1/variables/:varId/value (update value only)
Write-Host "`n[Test 6] PUT /api/v1/variables/:varId/value (update value)" -ForegroundColor Yellow
$updateValue = @{
    value = "$2,500,000"
    userId = $TestUserId
}
$result = Invoke-ApiCall -Method "PUT" -Uri "$API_BASE/api/v1/variables/$($createdVar1.varId)/value" -Body $updateValue
if ($result.Success -and $result.StatusCode -eq 200 -and $result.Data.ok) {
    Write-Host "✅ Variable value updated successfully" -ForegroundColor Green
    Write-Host "   Old value: $1,000,000" -ForegroundColor Gray
    Write-Host "   New value: $($result.Data.variable.value)" -ForegroundColor Gray
    
    if ($result.Data.variable.value -eq "$2,500,000") {
        Write-Host "✅ Value update verified" -ForegroundColor Green
    } else {
        Write-Host "❌ Value mismatch after update" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ Update variable value failed: $($result.Error)" -ForegroundColor Red
    exit 1
}

# Test 7: PUT /api/v1/variables/:varId (update metadata)
Write-Host "`n[Test 7] PUT /api/v1/variables/:varId (update metadata)" -ForegroundColor Yellow
$updateMetadata = @{
    displayLabel = "Total Contract Value"
    category = "Financial - Updated"
    userId = $TestUserId
}
$result = Invoke-ApiCall -Method "PUT" -Uri "$API_BASE/api/v1/variables/$($createdVar1.varId)" -Body $updateMetadata
if ($result.Success -and $result.StatusCode -eq 200 -and $result.Data.ok) {
    Write-Host "✅ Variable metadata updated successfully" -ForegroundColor Green
    Write-Host "   displayLabel: $($result.Data.variable.displayLabel)" -ForegroundColor Gray
    Write-Host "   category: $($result.Data.variable.category)" -ForegroundColor Gray
    Write-Host "   value unchanged: $($result.Data.variable.value)" -ForegroundColor Gray
} else {
    Write-Host "❌ Update variable metadata failed: $($result.Error)" -ForegroundColor Red
    exit 1
}

# Test 8: DELETE /api/v1/variables/:varId
Write-Host "`n[Test 8] DELETE /api/v1/variables/:varId" -ForegroundColor Yellow
$result = Invoke-ApiCall -Method "DELETE" -Uri "$API_BASE/api/v1/variables/$($createdVar2.varId)?userId=$TestUserId"
if ($result.Success -and $result.StatusCode -eq 200 -and $result.Data.ok) {
    Write-Host "✅ Variable deleted successfully" -ForegroundColor Green
    Write-Host "   Deleted varId: $($result.Data.varId)" -ForegroundColor Gray
} else {
    Write-Host "❌ Delete variable failed: $($result.Error)" -ForegroundColor Red
    exit 1
}

# Test 9: Verify deletion
Write-Host "`n[Test 9] Verify variable was deleted" -ForegroundColor Yellow
$result = Invoke-ApiCall -Method "GET" -Uri "$API_BASE/api/v1/variables"
if ($result.Success) {
    $var2StillExists = $null
    foreach ($prop in $result.Data.variables.PSObject.Properties) {
        if ($prop.Value.varId -eq $createdVar2.varId) {
            $var2StillExists = $prop.Value
        }
    }
    
    if ($var2StillExists) {
        Write-Host "❌ Deleted variable still exists!" -ForegroundColor Red
        exit 1
    } else {
        Write-Host "✅ Variable successfully deleted" -ForegroundColor Green
    }
} else {
    Write-Host "❌ GET variables failed: $($result.Error)" -ForegroundColor Red
    exit 1
}

# Test 10: Test duplicate varId prevention
Write-Host "`n[Test 10] Test duplicate varId prevention" -ForegroundColor Yellow
$duplicateVar = @{
    varId = $createdVar1.varId
    displayLabel = "Duplicate Test"
    type = "value"
    userId = $TestUserId
}
$result = Invoke-ApiCall -Method "POST" -Uri "$API_BASE/api/v1/variables" -Body $duplicateVar
if (-not $result.Success -and $result.StatusCode -eq 409) {
    Write-Host "✅ Duplicate varId correctly rejected (409)" -ForegroundColor Green
} else {
    Write-Host "❌ Duplicate varId should have been rejected!" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== All Tests Passed! ===" -ForegroundColor Green
Write-Host "✅ GET /api/v1/variables" -ForegroundColor Green
Write-Host "✅ POST /api/v1/variables (value type)" -ForegroundColor Green
Write-Host "✅ POST /api/v1/variables (signature type)" -ForegroundColor Green
Write-Host "✅ PUT /api/v1/variables/:varId/value" -ForegroundColor Green
Write-Host "✅ PUT /api/v1/variables/:varId" -ForegroundColor Green
Write-Host "✅ DELETE /api/v1/variables/:varId" -ForegroundColor Green
Write-Host "✅ Duplicate prevention" -ForegroundColor Green
Write-Host "`nBackend variables API is fully functional!" -ForegroundColor Cyan

