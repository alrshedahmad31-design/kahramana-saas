#!/usr/bin/env pwsh
# Regenerate src/lib/supabase/types.ts from the linked Supabase project.
#
# Slices the CLI output to the `export type Json` .. `} as const` band so
# stdout banners ("Initialising login role...", "A new version of Supabase
# CLI is available...") never land in the file. Forces LF line endings.
#
# Usage: pwsh scripts/gen-types.ps1   (or: npm run db:gen-types)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$outFile  = Join-Path $repoRoot 'src/lib/supabase/types.ts'

Write-Host 'Running: npx supabase gen types typescript --linked' -ForegroundColor Cyan

# Capture stdout only; stderr flows to the console so the user sees CLI
# warnings (linked-project mismatch, network errors, etc).
$raw = & npx supabase gen types typescript --linked
if ($LASTEXITCODE -ne 0) {
  throw "supabase gen types failed (exit $LASTEXITCODE)"
}

# PowerShell hands back a string[] of lines; join with LF so substring
# offsets are stable regardless of host line-ending quirks.
$body = ($raw -join "`n")

$startIdx = $body.IndexOf('export type Json')
if ($startIdx -lt 0) {
  throw "Could not find 'export type Json' marker in generator output."
}

$endMarker = '} as const'
$endIdx    = $body.LastIndexOf($endMarker)
if ($endIdx -lt 0) {
  throw "Could not find '} as const' end marker in generator output."
}

$sliced = $body.Substring($startIdx, ($endIdx + $endMarker.Length) - $startIdx)

# Normalize to LF + single trailing newline. WriteAllText with explicit
# UTF8Encoding(false) avoids BOM and skips PowerShell's redirect-CRLF path.
$normalized = ($sliced -replace "`r`n", "`n" -replace "`r", "`n").TrimEnd("`n") + "`n"
[IO.File]::WriteAllText($outFile, $normalized, [Text.UTF8Encoding]::new($false))

$lineCount = ($normalized -split "`n").Length - 1
Write-Host "Wrote $outFile ($lineCount lines, LF)" -ForegroundColor Green
