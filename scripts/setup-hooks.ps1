#!/usr/bin/env pwsh

# Setup Git hooks for PetHotel project
# This script should be run after cloning the repository on Windows

$ErrorActionPreference = "Stop"

$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "Setting up Git hooks for PetHotel..." -ForegroundColor Cyan
Write-Host ""

# Copy pre-commit hook from .husky to .git/hooks
Write-Host "Installing pre-commit hook..." -ForegroundColor Yellow

$huskyPreCommit = Join-Path $PROJECT_ROOT ".husky/pre-commit"
$gitHooksDir = Join-Path $PROJECT_ROOT ".git/hooks"
$gitPreCommit = Join-Path $gitHooksDir "pre-commit"

if (Test-Path $huskyPreCommit) {
    # Read husky pre-commit content
    $content = Get-Content $huskyPreCommit -Raw -Encoding UTF8

    # Adapt for .git/hooks (remove husky.sh line and update PROJECT_ROOT)
    $huskyLine = '. "$(dirname -- "$0")/_/husky.sh"'
    $content = $content.Replace($huskyLine, '')

    $oldRoot = 'PROJECT_ROOT="$(cd "$(dirname -- "$0")/.." && pwd)"'
    $newRoot = 'PROJECT_ROOT="$(cd "$(dirname -- "$0")/../.." && pwd)"'
    $content = $content.Replace($oldRoot, $newRoot)

    # Remove empty lines at the beginning
    $content = $content.TrimStart()

    # Add shebang if missing
    if (-not $content.StartsWith('#!/usr/bin/env sh')) {
        $content = "#!/usr/bin/env sh`n`n" + $content
    }

    # Create hooks directory if it doesn't exist
    if (-not (Test-Path $gitHooksDir)) {
        New-Item -ItemType Directory -Path $gitHooksDir -Force | Out-Null
    }

    # Write file with Unix line endings (LF)
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($gitPreCommit, $content, $utf8NoBom)

    Write-Host "Pre-commit hook installed at .git/hooks/pre-commit" -ForegroundColor Green
} else {
    Write-Host "File .husky/pre-commit not found!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Git hooks setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Pre-commit will check:"
Write-Host "  - ESLint and Prettier (frontend)"
Write-Host "  - TypeScript types (frontend)"
Write-Host "  - StyleCop (backend, if .cs files changed)"
Write-Host "  - Build (backend, if .cs files changed)"
Write-Host ""
Write-Host "To skip checks use: git commit --no-verify" -ForegroundColor Yellow
