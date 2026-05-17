$baseKey = "HKCU:\Software\Classes\*\shell\FileTagzTest"
New-Item -Path $baseKey -Force | Out-Null
Set-ItemProperty -Path $baseKey -Name "MUIVerb" -Value "Tag with FileTagz"
Set-ItemProperty -Path $baseKey -Name "Icon" -Value "C:\Users\vardh\.gemini\antigravity\scratch\FileTagz\src\icon.png"

$shellKey = "$baseKey\shell"
New-Item -Path $shellKey -Force | Out-Null

$tagKey = "$shellKey\tag1"
New-Item -Path $tagKey -Force | Out-Null
Set-ItemProperty -Path $tagKey -Name "MUIVerb" -Value "🔴 Urgent"

$cmdKey = "$tagKey\command"
New-Item -Path $cmdKey -Force | Out-Null
Set-ItemProperty -Path $cmdKey -Name "(default)" -Value "cmd.exe /c echo %1"
