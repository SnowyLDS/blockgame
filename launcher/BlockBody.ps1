# 블록 바디 실행기
#  게임 폴더를 이 컴퓨터 안에서만 접속되는 작은 웹 서버로 띄우고,
#  Edge(없으면 Chrome)를 주소창 없는 앱 창으로 엽니다. 창을 닫으면 서버도 끝납니다.
param([int]$TestSeconds = 0) # 개발용: 브라우저 없이 n초 동안 서버만 띄움
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
function Fail($msg) { [System.Windows.Forms.MessageBox]::Show($msg, '블록 바디') | Out-Null; exit 1 }

# 포트: 고정 포트를 먼저 시도 (저장 데이터가 포트별로 나뉘므로), 사용 중이면 빈 포트
$http = $null
foreach ($port in @(47321, 47322, 47323, 0)) {
  if ($port -eq 0) {
    $probe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    $probe.Start(); $port = $probe.LocalEndpoint.Port; $probe.Stop()
  }
  try {
    $http = New-Object System.Net.HttpListener
    $http.Prefixes.Add("http://localhost:$port/")
    $http.Start()
    break
  } catch { $http = $null }
}
if (-not $http) { Fail '게임 서버를 시작하지 못했습니다.' }

# 브라우저 찾기
$browsers = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ }
if (-not $browsers) { $http.Stop(); Fail 'Microsoft Edge 또는 Chrome 이 필요합니다.' }
$profileDir = Join-Path $env:LOCALAPPDATA 'BlockBody\browser'
$url = "http://localhost:$port/"
if ($TestSeconds -gt 0) {
  $proc = Start-Process -FilePath 'powershell.exe' -PassThru -WindowStyle Hidden -ArgumentList "-NoProfile -Command Start-Sleep $TestSeconds"
  Write-Output "TEST SERVER $url"
} else {
$proc = Start-Process -FilePath $browsers[0] -PassThru -ArgumentList @(
  "--app=$url", "--user-data-dir=`"$profileDir`"", '--window-size=1320,920',
  '--no-first-run', '--no-default-browser-check', '--disable-features=Translate'
)
}

$types = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.ico' = 'image/x-icon'; '.json' = 'application/json'; '.svg' = 'image/svg+xml'
}
$rootFull = [System.IO.Path]::GetFullPath($root)

# 요청 처리 (브라우저 창이 닫힐 때까지)
$pending = $http.GetContextAsync()
while (-not $proc.HasExited) {
  if (-not $pending.Wait(300)) { continue }
  $ctx = $pending.Result
  $pending = $http.GetContextAsync()
  try {
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ($rel -eq '') { $rel = 'index.html' }
    $file = [System.IO.Path]::GetFullPath((Join-Path $rootFull $rel))
    if ($file.StartsWith($rootFull) -and (Test-Path $file -PathType Leaf)) {
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $ext = [System.IO.Path]::GetExtension($file).ToLower()
      $ctx.Response.ContentType = $(if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' })
      $ctx.Response.Headers.Add('Cache-Control', 'no-cache')
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else { $ctx.Response.StatusCode = 404 }
  } catch { } finally { try { $ctx.Response.Close() } catch { } }
}
$http.Stop()
