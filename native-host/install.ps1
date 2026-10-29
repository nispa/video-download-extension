# Connects Video Grabber to yt-dlp: registers the native messaging host for Firefox,
# Edge, Chrome and Chromium (current user only, no administrator rights needed).
$ErrorActionPreference = 'Stop'

$hostName = 'video_grabber_ytdlp'
$firefoxId = 'video-grabber@local'
# Fixed ID of the Edge/Chrome build, derived from the "key" in scripts/manifests.js.
$chromiumId = 'kkepmgeaianpmifckpogfjhddmhbdnlg'

$dir = $PSScriptRoot
$batPath = Join-Path $dir 'host.bat'
$utf8 = New-Object System.Text.UTF8Encoding($false)

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw 'Node.js not found in PATH: install it from https://nodejs.org' }
if (-not (Get-Command yt-dlp -ErrorAction SilentlyContinue)) {
  Write-Warning 'yt-dlp not found in PATH. Install it with: winget install yt-dlp.yt-dlp'
}
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Warning 'ffmpeg not found in PATH (needed to join video and audio): winget install Gyan.FFmpeg'
}

# The browser starts this .bat, which runs the host with the Node found now.
[IO.File]::WriteAllText($batPath, "@echo off`r`n`"$($node.Source)`" `"%~dp0host.js`" %*`r`n", $utf8)

function Write-HostManifest($file, $allowKey, $allowValue) {
  $manifest = [ordered]@{
    name        = $hostName
    description = 'Video Grabber - downloads with yt-dlp'
    path        = $batPath
    type        = 'stdio'
  }
  $manifest[$allowKey] = @($allowValue)
  $path = Join-Path $dir $file
  [IO.File]::WriteAllText($path, ($manifest | ConvertTo-Json), $utf8)
  return $path
}

# Firefox allows hosts per extension ID, Chromium browsers per origin.
$firefoxManifest = Write-HostManifest "$hostName.firefox.json" 'allowed_extensions' $firefoxId
$chromiumManifest = Write-HostManifest "$hostName.chromium.json" 'allowed_origins' "chrome-extension://$chromiumId/"

$keys = [ordered]@{
  'Firefox'  = @("HKCU:\Software\Mozilla\NativeMessagingHosts\$hostName", $firefoxManifest)
  'Edge'     = @("HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$hostName", $chromiumManifest)
  'Chrome'   = @("HKCU:\Software\Google\Chrome\NativeMessagingHosts\$hostName", $chromiumManifest)
  'Chromium' = @("HKCU:\Software\Chromium\NativeMessagingHosts\$hostName", $chromiumManifest)
}
foreach ($browser in $keys.Keys) {
  $key, $manifestPath = $keys[$browser]
  New-Item -Path $key -Value $manifestPath -Force | Out-Null
  Write-Host "$browser -> $key"
}

Write-Host 'Done. Restart the browser to use yt-dlp.'
