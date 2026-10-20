# 설치 파일(BlockBody-Setup.exe) 만들기
#  필요: Inno Setup 6  (winget install JRSoftware.InnoSetup)
#  결과: installer\output\BlockBody-Setup.exe
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$iscc = @(
  "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
  "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
  "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iscc) { Write-Host 'Inno Setup 6 이 없습니다. 먼저 설치하세요: winget install JRSoftware.InnoSetup'; exit 1 }
& $iscc "$here\BlockBody.iss"
if ($LASTEXITCODE -eq 0) { Write-Host "완료: $here\output\BlockBody-Setup.exe" }
