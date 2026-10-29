# Disconnects Video Grabber from yt-dlp in Firefox, Edge, Chrome and Chromium.
$hostName = 'video_grabber_ytdlp'
foreach ($vendor in 'Mozilla', 'Microsoft\Edge', 'Google\Chrome', 'Chromium') {
  Remove-Item -Path "HKCU:\Software\$vendor\NativeMessagingHosts\$hostName" -Force -ErrorAction SilentlyContinue
}
foreach ($file in "$hostName.firefox.json", "$hostName.chromium.json", 'host.bat') {
  Remove-Item -Path (Join-Path $PSScriptRoot $file) -Force -ErrorAction SilentlyContinue
}
Write-Host 'yt-dlp disconnected.'
