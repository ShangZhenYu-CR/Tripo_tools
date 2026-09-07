$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ManifestPath = Join-Path $Root 'manifest.json'
$Dist = Join-Path $Root 'dist'
$Private = Join-Path $Root 'private'
$KeyPath = Join-Path $Private 'TripoMultiviewPaste.pem'
$StageRoot = Join-Path $env:TEMP 'TripoMultiviewPaste-pack'
$Stage = Join-Path $StageRoot 'extension'

$RuntimeFiles = @(
    'manifest.json',
    'background.js',
    'content-tripo.js',
    'panel-close.js',
    'popup.html',
    'popup.css',
    'popup.js'
)

if (!(Test-Path $ManifestPath)) {
    throw "manifest.json not found: $ManifestPath"
}

$EdgeCandidates = @(
    "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { $_ -and (Test-Path $_) }

if (!$EdgeCandidates -or $EdgeCandidates.Count -eq 0) {
    throw 'Microsoft Edge executable was not found.'
}
$Edge = $EdgeCandidates[0]

$Manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
$Version = [string]$Manifest.version
if (!$Version) { throw 'manifest.json does not contain a version.' }

New-Item -ItemType Directory -Force -Path $Dist | Out-Null
New-Item -ItemType Directory -Force -Path $Private | Out-Null

if (Test-Path $StageRoot) {
    Remove-Item $StageRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $Stage | Out-Null

foreach ($File in $RuntimeFiles) {
    $Source = Join-Path $Root $File
    if (!(Test-Path $Source)) { throw "Required runtime file missing: $File" }
    Copy-Item $Source (Join-Path $Stage $File) -Force
}

$GeneratedCrx = "$Stage.crx"
$GeneratedPem = "$Stage.pem"

Write-Host "Packing Tripo Multiview Paste v$Version" -ForegroundColor Cyan
Write-Host "Edge: $Edge"

if (Test-Path $KeyPath) {
    Write-Host 'Using existing private key. Extension ID will stay the same.' -ForegroundColor Green
    & $Edge --pack-extension="$Stage" --pack-extension-key="$KeyPath"
} else {
    Write-Host 'First pack: generating a new private key.' -ForegroundColor Yellow
    & $Edge --pack-extension="$Stage"
}

Start-Sleep -Milliseconds 700

if (!(Test-Path $GeneratedCrx)) {
    throw "CRX was not generated: $GeneratedCrx"
}

$OutputCrx = Join-Path $Dist "TripoMultiviewPaste-v$Version.crx"
Move-Item $GeneratedCrx $OutputCrx -Force

if (Test-Path $GeneratedPem) {
    if (Test-Path $KeyPath) {
        Remove-Item $GeneratedPem -Force
    } else {
        Move-Item $GeneratedPem $KeyPath -Force
        Write-Host "Private key created: $KeyPath" -ForegroundColor Yellow
        Write-Host 'BACK UP THIS PEM FILE. Do not upload it to GitHub.' -ForegroundColor Yellow
    }
}

Remove-Item $StageRoot -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ''
Write-Host "Done: $OutputCrx" -ForegroundColor Green
Write-Host 'For future versions, keep private\TripoMultiviewPaste.pem and run this script again.'
