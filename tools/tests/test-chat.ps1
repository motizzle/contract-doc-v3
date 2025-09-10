# Test script to send chat message to Ollama server
Write-Host "Testing Ollama integration..." -ForegroundColor Green

$testMessage = @{
    type = "chat"
    payload = @{
        text = "What are the key challenges with contract documents mentioned in the contract?"
    }
    userId = "test-user"
    platform = "web"
} | ConvertTo-Json

Write-Host "Sending message: $testMessage" -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest `
        -Uri "https://localhost:4001/api/v1/events/client" `
        -Method POST `
        -Body $testMessage `
        -ContentType "application/json" `
        -UseBasicParsing

    Write-Host "Response Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response Content: $($response.Content)" -ForegroundColor Cyan
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Test completed. Check server logs for debug output!" -ForegroundColor Green
