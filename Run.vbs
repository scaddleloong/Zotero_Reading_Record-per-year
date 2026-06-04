Set WshShell = CreateObject("WScript.Shell")

currentScriptPath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = currentScriptPath & "\Scripts"

WshShell.Run "..\.venv\Scripts\python.exe main.py", 0

Set WshShell = Nothing