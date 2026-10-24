param(
  [string]$PackageRoot=$PSScriptRoot,
  [string]$AppRoot=(Join-Path $env:LOCALAPPDATA 'Programs\GspMotion'),
  [string]$BinRoot=(Join-Path $env:USERPROFILE '.local\bin'),
  [string]$SkillRoot,
  [switch]$NoPath
)
$ErrorActionPreference='Stop'
if ([IntPtr]::Size -ne 8 -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { throw 'Windows x64 is required.' }
if (!$SkillRoot) {
  $skillHome=if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
  $SkillRoot=Join-Path $skillHome 'skills\gsp-motion'
}
$packageFull=[IO.Path]::GetFullPath($PackageRoot)
foreach ($name in @('AppRoot','BinRoot','SkillRoot')) {
  $resolved=[IO.Path]::GetFullPath((Get-Variable -Name $name -ValueOnly))
  if ($resolved.TrimEnd('\') -eq [IO.Path]::GetPathRoot($resolved).TrimEnd('\') -or $resolved.TrimEnd('\') -eq $env:USERPROFILE.TrimEnd('\')) { throw "Unsafe install directory: $name" }
  Set-Variable -Name $name -Value $resolved
}
foreach ($file in @('gsp-motion.exe','tool\cli.cjs','tool\package.json','runtime\node.exe','runtime\ffmpeg.exe','skill\gsp-motion\SKILL.md')) {
  if (!(Test-Path -LiteralPath (Join-Path $packageFull $file) -PathType Leaf)) { throw "Incomplete package: $file" }
}
$doctor=& (Join-Path $packageFull 'gsp-motion.exe') doctor --json
if ($LASTEXITCODE -ne 0 -or !(($doctor | ConvertFrom-Json).ok)) { throw 'Package runtime check failed.' }
foreach ($folder in @($AppRoot,$BinRoot,$SkillRoot)) { New-Item -ItemType Directory -Path $folder -Force | Out-Null }
if ($packageFull.TrimEnd('\') -ne $AppRoot.TrimEnd('\')) {
  foreach ($item in Get-ChildItem -LiteralPath $packageFull) { Copy-Item -LiteralPath $item.FullName -Destination $AppRoot -Recurse -Force }
}
Copy-Item -LiteralPath (Join-Path $AppRoot 'gsp-motion.exe') -Destination (Join-Path $BinRoot 'gsp-motion.exe') -Force
[IO.File]::WriteAllText((Join-Path $BinRoot 'gsp-motion.home'),$AppRoot,[Text.UTF8Encoding]::new($false))
foreach ($item in Get-ChildItem -LiteralPath (Join-Path $AppRoot 'skill\gsp-motion')) { Copy-Item -LiteralPath $item.FullName -Destination $SkillRoot -Recurse -Force }
if (!$NoPath) {
  $userPath=[Environment]::GetEnvironmentVariable('Path','User')
  if (($userPath -split ';') -notcontains $BinRoot) { [Environment]::SetEnvironmentVariable('Path',($BinRoot+';'+$userPath),'User') }
  if (($env:Path -split ';') -notcontains $BinRoot) { $env:Path=$BinRoot+';'+$env:Path }
}
& (Join-Path $BinRoot 'gsp-motion.exe') doctor --json
if ($LASTEXITCODE -ne 0) { throw 'Installed CLI dependency check failed.' }
Write-Output ('Executable: '+(Join-Path $BinRoot 'gsp-motion.exe'))
Write-Output ('Skill: '+(Join-Path $SkillRoot 'SKILL.md'))
