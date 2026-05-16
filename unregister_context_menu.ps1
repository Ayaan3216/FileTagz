Write-Host "Removing FileTagz from Windows Context Menu..." -ForegroundColor Yellow

$fileKey = "HKCU:\Software\Classes\*\shell\FileTagz"
if (Test-Path $fileKey) { 
    Remove-Item -Path $fileKey -Recurse -Force 
    Write-Host "Removed file context menu."
}

$dirKey = "HKCU:\Software\Classes\Directory\shell\FileTagz"
if (Test-Path $dirKey) { 
    Remove-Item -Path $dirKey -Recurse -Force 
    Write-Host "Removed folder context menu."
}

Write-Host "Uninstallation complete." -ForegroundColor Green
Pause
