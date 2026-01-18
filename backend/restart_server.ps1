# Restart Backend Server Script
Write-Host "Stopping existing backend server..." -ForegroundColor Yellow

# Find and kill process on port 8000
$process = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
if ($process) {
    Stop-Process -Id $process -Force
    Write-Host "Stopped process $process" -ForegroundColor Green
    Start-Sleep -Seconds 2
} else {
    Write-Host "No process found on port 8000" -ForegroundColor Gray
}

Write-Host "Starting backend server..." -ForegroundColor Yellow
python api.py
