param([string]$PackageRoot)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$version=(Get-Content -Raw -LiteralPath (Join-Path $root 'package.json') | ConvertFrom-Json).version
if (!$PackageRoot) { $PackageRoot=Join-Path $root "dist\gsp-motion-$version-win-x64" }
$packageFull=[IO.Path]::GetFullPath($PackageRoot)
if (!(Test-Path -LiteralPath (Join-Path $packageFull 'manifest.json'))) { throw 'Run node scripts/build-package.cjs first.' }
$zip=Join-Path $root "dist\gsp-motion-$version-win-x64.zip"
Compress-Archive -LiteralPath $packageFull -DestinationPath $zip -CompressionLevel Optimal -Force
$assets=@(Get-Item -LiteralPath $zip)+@(Get-ChildItem -LiteralPath (Join-Path $root 'dist') -Filter '*-source-*.tar.gz' -File)
$lines=@($assets | ForEach-Object { (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()+'  '+$_.Name })
[IO.File]::WriteAllText((Join-Path $root 'dist\SHA256SUMS'),($lines -join "`n")+"`n",[Text.UTF8Encoding]::new($false))
Write-Output $zip
Write-Output $lines
