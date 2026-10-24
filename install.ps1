param(
  [string]$Version='latest',
  [string]$Repository='hjm-jim/gsp-motion',
  [string]$AppRoot,
  [string]$BinRoot,
  [string]$SkillRoot,
  [switch]$NoPath
)
$ErrorActionPreference='Stop'
if ($env:OS -ne 'Windows_NT' -or [IntPtr]::Size -ne 8 -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { throw 'This installer requires Windows x64.' }
if ($Repository -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') { throw 'Repository must be owner/repo.' }
[Net.ServicePointManager]::SecurityProtocol=[Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
$headers=@{'User-Agent'='gsp-motion-installer'}
if ($Version -eq 'latest') {
  $release=Invoke-RestMethod -Uri "https://api.github.com/repos/$Repository/releases/latest" -Headers $headers
  $Version=$release.tag_name
}
if ($Version -notmatch '^v?\d+\.\d+\.\d+$') { throw 'Version must be latest or a version such as v0.7.1.' }
$number=$Version.TrimStart('v')
$tag='v'+$number
$asset="gsp-motion-$number-win-x64.zip"
$base="https://github.com/$Repository/releases/download/$tag"
$temp=Join-Path ([IO.Path]::GetTempPath()) ('gsp-motion-install-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temp | Out-Null
try {
  $zip=Join-Path $temp $asset
  $sums=Join-Path $temp 'SHA256SUMS'
  Invoke-WebRequest -UseBasicParsing -Uri "$base/$asset" -OutFile $zip -Headers $headers
  Invoke-WebRequest -UseBasicParsing -Uri "$base/SHA256SUMS" -OutFile $sums -Headers $headers
  $entries=@(Get-Content -LiteralPath $sums | Where-Object { $_ -match ('^([A-Fa-f0-9]{64})\s+\*?'+[regex]::Escape($asset)+'$') })
  if ($entries.Count -ne 1) { throw 'Release does not have exactly one matching checksum.' }
  $expected=($entries[0] -split '\s+')[0]
  if ((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash -ne $expected) { throw 'SHA256 verification failed; nothing was installed.' }
  Expand-Archive -LiteralPath $zip -DestinationPath (Join-Path $temp 'expanded')
  $package=Join-Path $temp "expanded\gsp-motion-$number-win-x64"
  $arguments=@{PackageRoot=$package;NoPath=$NoPath}
  foreach ($name in @('AppRoot','BinRoot','SkillRoot')) { $value=Get-Variable -Name $name -ValueOnly; if ($value) { $arguments[$name]=$value } }
  & (Join-Path $package 'install.ps1') @arguments
} finally {
  $resolved=[IO.Path]::GetFullPath($temp)
  if ([IO.Path]::GetDirectoryName($resolved).TrimEnd('\') -eq [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') -and [IO.Path]::GetFileName($resolved).StartsWith('gsp-motion-install-')) { Remove-Item -LiteralPath $resolved -Recurse -Force }
}
