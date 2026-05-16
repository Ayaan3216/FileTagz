Set WshShell = CreateObject("WScript.Shell")
If WScript.Arguments.Count > 0 Then
    arg = WScript.Arguments(0)
Else
    arg = ""
End If
' Run the app hidden
WshShell.Run "cmd.exe /c cd /d """ & CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & """ && set PATH=C:\Program Files\nodejs;%PATH% && npm start -- """ & arg & """", 0, False
