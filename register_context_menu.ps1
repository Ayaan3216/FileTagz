$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$electronPath = "$scriptPath\node_modules\.bin\electron.cmd"
$appPath = "$scriptPath"

if (-not (Test-Path $electronPath)) {
    Write-Host "Please run 'npm install' first." -ForegroundColor Red
    exit
}

# Command to execute
$command = "`"$electronPath`" `"$appPath`" `"%1`""

Write-Host "Registering FileTagz to Windows Context Menu..." -ForegroundColor Cyan

# Register for all files (*)
$fileKey = "HKCU:\Software\Classes\*\shell\FileTagz"
if (Test-Path $fileKey) { Remove-Item -Path $fileKey -Recurse -Force }
New-Item -Path $fileKey -Force | Out-Null
Set-ItemProperty -Path $fileKey -Name "(default)" -Value "Tag with FileTagz"
Set-ItemProperty -Path $fileKey -Name "Icon" -Value "$scriptPath\src\icon.png"
New-Item -Path "$fileKey\command" -Force | Out-Null
Set-ItemProperty -Path "$fileKey\command" -Name "(default)" -Value $command

# Register for all directories (Directory)
$dirKey = "HKCU:\Software\Classes\Directory\shell\FileTagz"
if (Test-Path $dirKey) { Remove-Item -Path $dirKey -Recurse -Force }
New-Item -Path $dirKey -Force | Out-Null
Set-ItemProperty -Path $dirKey -Name "(default)" -Value "Tag with FileTagz"
Set-ItemProperty -Path $dirKey -Name "Icon" -Value "$scriptPath\src\icon.png"
New-Item -Path "$dirKey\command" -Force | Out-Null
Set-ItemProperty -Path "$dirKey\command" -Name "(default)" -Value $command

Write-Host "Successfully registered! You can now right-click any file or folder to tag it." -ForegroundColor Green
