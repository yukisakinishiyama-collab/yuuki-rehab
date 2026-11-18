# 読影プログラム（yuuki-dicom-reader）を、このパソコンに入れる・更新する。
#   powershell -ExecutionPolicy Bypass -File tools\dicom-reader\install.ps1
# - 置き場所: %USERPROFILE%\yuuki-dicom-reader（プログラム）／ %LOCALAPPDATA%\yuuki-dicom-reader（設定・下書き）
# - Python 3.11 以上と、Claude Code（claude にログイン済み）、Chrome か Edge が要る
# - ログインのたびに自動で起動する（スタートアップ）。デスクトップに「読影プログラムを起動」を置く
$ErrorActionPreference = 'Stop'
$src  = Split-Path -Parent $MyInvocation.MyCommand.Path
$dest = Join-Path $env:USERPROFILE 'yuuki-dicom-reader'
$py = $null
foreach ($c in @('py', 'python')) { if (Get-Command $c -ErrorAction SilentlyContinue) { $py = $c; break } }
if (-not $py) { throw 'Python が見つかりません（python.org から 3.11 以上を入れてください）' }

# 動いていれば止める
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*reader.server*' -and $_.ExecutablePath -like "$dest*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -Confirm:$false -ErrorAction SilentlyContinue }

New-Item -ItemType Directory -Force $dest | Out-Null
if ((Resolve-Path $src).Path -ne (Resolve-Path $dest).Path) {
  if (Test-Path (Join-Path $dest 'reader')) { Remove-Item (Join-Path $dest 'reader') -Recurse -Force -Confirm:$false }
  Copy-Item (Join-Path $src 'reader') (Join-Path $dest 'reader') -Recurse
  Copy-Item (Join-Path $src 'install.ps1'), (Join-Path $src 'README.md') $dest -Force
}
Get-ChildItem $dest -Recurse -Directory -Filter '__pycache__' | Remove-Item -Recurse -Force -Confirm:$false

$venv = Join-Path $dest '.venv'
if (-not (Test-Path (Join-Path $venv 'Scripts\python.exe'))) { & $py -m venv $venv }
$vpy = Join-Path $venv 'Scripts\python.exe'
& $vpy -m pip install --quiet --disable-pip-version-check --upgrade numpy pydicom pillow
if ($LASTEXITCODE -ne 0) { throw 'numpy / pydicom / pillow を入れられませんでした' }
# 圧縮されたDICOM（JPEG など）を開くための追加。入らないパソコンでは無しで動く（非圧縮のCDは読める）
& $vpy -m pip install --quiet --disable-pip-version-check pylibjpeg pylibjpeg-libjpeg pylibjpeg-openjpeg 2>$null
$global:LASTEXITCODE = 0

$sh = New-Object -ComObject WScript.Shell
foreach ($lnk in @((Join-Path ([Environment]::GetFolderPath('Startup')) 'yuuki-dicom-reader.lnk'),
                   (Join-Path ([Environment]::GetFolderPath('Desktop')) '読影プログラムを起動.lnk'))) {
  $s = $sh.CreateShortcut($lnk)
  $s.TargetPath = Join-Path $venv 'Scripts\pythonw.exe'
  $s.Arguments = '-m reader.server'
  $s.WorkingDirectory = $dest
  $s.Description = 'ゆうき整骨院 読影プログラム（カルテの画像レポート）'
  $s.Save()
}
Start-Process -FilePath (Join-Path $venv 'Scripts\pythonw.exe') -ArgumentList '-m', 'reader.server' -WorkingDirectory $dest
$ok = $false
foreach ($i in 1..20) { try { $h = Invoke-RestMethod 'http://127.0.0.1:8791/health' -TimeoutSec 3; $ok = $true; break } catch { Start-Sleep -Milliseconds 700 } }
if ($ok) { "OK  version=$($h.version) claude=$($h.claude) loggedIn=$($h.loggedIn) pdf=$($h.pdf)" } else { throw '起動を確かめられませんでした' }
