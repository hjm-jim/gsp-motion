param(
  [string]$FfmpegPath,
  [string]$AppRoot,
  [string]$BinRoot,
  [string]$SkillRoot,
  [switch]$NoPath
)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
if ($env:OS -ne 'Windows_NT' -or [IntPtr]::Size -ne 8 -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { throw 'Source installation currently targets Windows x64.' }
if (!(Get-Command node -ErrorAction SilentlyContinue) -or !(Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'Install Node.js 20.9+ (including npm), then reopen PowerShell.' }
if (!$FfmpegPath) { $cmd=Get-Command ffmpeg -ErrorAction SilentlyContinue; if ($cmd) { $FfmpegPath=$cmd.Source } }
if (!$FfmpegPath -or !(Test-Path -LiteralPath $FfmpegPath -PathType Leaf)) { throw 'Install FFmpeg with libx264 support and put it on PATH, or pass -FfmpegPath C:\path\ffmpeg.exe. See INSTALL.md.' }
$previousFfmpeg=$env:FFMPEG_PATH
Push-Location $root
try {
  & node -e "const [a,b]=process.versions.node.split('.').map(Number);if(a<20||(a===20&&b<9))process.exit(1)"
  if ($LASTEXITCODE -ne 0) { throw 'Node.js 20.9+ is required.' }
  & npm.cmd ci --omit=dev --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
  $env:FFMPEG_PATH=[IO.Path]::GetFullPath($FfmpegPath)
  & node scripts/build-package.cjs
  if ($LASTEXITCODE -ne 0) { throw 'Package build failed.' }
  $version=(Get-Content -Raw -LiteralPath (Join-Path $root 'package.json') | ConvertFrom-Json).version
  $package=Join-Path $root "dist\gsp-motion-$version-win-x64"
  $arguments=@{PackageRoot=$package;NoPath=$NoPath}
  foreach ($name in @('AppRoot','BinRoot','SkillRoot')) { $value=Get-Variable -Name $name -ValueOnly; if ($value) { $arguments[$name]=$value } }
  & (Join-Path $package 'install.ps1') @arguments
} finally { Pop-Location; $env:FFMPEG_PATH=$previousFfmpeg }
