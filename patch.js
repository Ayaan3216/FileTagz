const fs = require('fs');
let content = fs.readFileSync('main.js', 'utf-8');

if (!content.includes('function syncContextMenu')) {
  content += `\n
// ─── Windows Context Menu Synchronization ────────────────────────────────────
function syncContextMenu() {
  if (process.platform !== 'win32') return;
  const path = require('path');
  const { exec } = require('child_process');
  
  const APPDATA_DIR = path.join(require('electron').app.getPath('appData'), 'FileTagz');
  const scriptPath = path.join(APPDATA_DIR, 'sync_menu.ps1');
  const appPath = require('electron').app.getAppPath();
  const exePath = process.execPath;
  
  const tags = db.tagDefinitions || [];
  
  let ps = \`
$ErrorActionPreference = 'SilentlyContinue'
$fileKey = "HKCU:\\Software\\Classes\\*\\shell\\FileTagz"
$dirKey = "HKCU:\\Software\\Classes\\Directory\\shell\\FileTagz"

function CreateMenu($baseKey) {
    if (Test-Path $baseKey) { Remove-Item -Path $baseKey -Recurse -Force }
    New-Item -Path $baseKey -Force | Out-Null
    Set-ItemProperty -Path $baseKey -Name "MUIVerb" -Value "Tag with FileTagz"
    Set-ItemProperty -Path $baseKey -Name "Icon" -Value "\$(\\"\${exePath}\\")"
    Set-ItemProperty -Path $baseKey -Name "ExtendedSubCommandsKey" -Value $null

    $shellKey = "$baseKey\\shell"
    New-Item -Path $shellKey -Force | Out-Null

    $openAppKey = "$shellKey\\open_app"
    New-Item -Path $openAppKey -Force | Out-Null
    Set-ItemProperty -Path $openAppKey -Name "MUIVerb" -Value "📂 Open in FileTagz"
    New-Item -Path "$openAppKey\\command" -Force | Out-Null
    Set-ItemProperty -Path "$openAppKey\\command" -Name "(default)" -Value "\\"\${exePath}\\" \\"\${appPath}\\" \\"%1\\""
    
    $sepKey = "$shellKey\\sep1"
    New-Item -Path $sepKey -Force | Out-Null
    Set-ItemProperty -Path $sepKey -Name "CommandFlags" -Value 0x20 -Type DWord
\`;

  tags.forEach((tag, i) => {
    const verb = \`\${tag.icon} \${tag.name}\`.replace(/"/g, '""');
    ps += \`
    $tagKey\${i} = "$shellKey\\tag_\${tag.id}"
    New-Item -Path $tagKey\${i} -Force | Out-Null
    Set-ItemProperty -Path $tagKey\${i} -Name "MUIVerb" -Value "\${verb}"
    New-Item -Path "$tagKey\${i}\\command" -Force | Out-Null
    Set-ItemProperty -Path "$tagKey\${i}\\command" -Name "(default)" -Value "\\"\${exePath}\\" \\"\${appPath}\\" --apply-tag \\"\${tag.id}\\" \\"%1\\""
\`;
  });

  ps += \`
}

CreateMenu $fileKey
CreateMenu $dirKey
\`;
  
  require('fs').writeFileSync(scriptPath, ps, 'utf-8');
  exec(\`powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File "\${scriptPath}"\`);
}
`;

  content = content.replace(
    /createTray\(\);\n\}\);/,
    'createTray();\n  syncContextMenu();\n});'
  );
  
  fs.writeFileSync('main.js', content);
}
