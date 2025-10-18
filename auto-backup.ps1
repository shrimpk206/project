param([string]$Message = "")

# Always operate at repo root
Set-Location -Path $PSScriptRoot

# 1) Check git
$gitVersion = $null
try { $gitVersion = git --version 2>$null } catch {}
if (-not $gitVersion) {
  Write-Host "Git not found. Install: https://git-scm.com/downloads" -ForegroundColor Red
  exit 1
}

# 2) Check git repo
$insideRepo = $null
try { $insideRepo = git rev-parse --is-inside-work-tree 2>$null } catch {}
if ($insideRepo -ne "true") {
  Write-Host "Not a Git repository. Run 'git init' first." -ForegroundColor Red
  exit 1
}

# 3) Skip if no changes
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
  Write-Host "No changes to commit." -ForegroundColor Yellow
  exit 0
}

# 4) Stage all
git add -A

# 5) Commit message
$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
if ([string]::IsNullOrWhiteSpace($Message)) {
  $commitMsg = "auto backup: $ts"
} else {
  $commitMsg = "auto backup: $ts - $Message"
}

git commit -m "$commitMsg"

# 6) Current branch (default main)
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ([string]::IsNullOrWhiteSpace($branch)) { $branch = "main" }

# 7) Upstream check
$hasUpstream = $true
try {
  git rev-parse --abbrev-ref --symbolic-full-name "@{u}" | Out-Null
} catch {
  $hasUpstream = $false
}

if (-not $hasUpstream) {
  Write-Host "Setting upstream to origin/$branch..."
  git push -u origin $branch
} else {
  git push
}

Write-Host "Auto backup done: $commitMsg" -ForegroundColor Green
