# Kahramana — Claude.ai ↔ Claude Code Bridge
# Run at start of every session: pwsh .agent/sync-context.ps1

$head = git rev-parse HEAD
$date = Get-Date -Format 'yyyy-MM-dd HH:mm'
$aiContext = Get-Content .agent/CLAUDE-AI-CONTEXT.md -Raw -ErrorAction SilentlyContinue

$session = @"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KAHRAMANA — BRIDGE CONTEXT
Generated: $date
Master: $head
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

$aiContext
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"@

Set-Content .agent/CURRENT-SESSION.md $session -Encoding UTF8
Write-Host "✅ Bridge synced — ready for Claude Code"
cat .agent/CURRENT-SESSION.md
