param()
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'SilentlyContinue'

$raw = [Console]::In.ReadToEnd()
$lockFile = Join-Path $PSScriptRoot "evaluating.lock"

# 이미 이벨류에이터가 실행 중이면 스킵 (무한 루프 방지)
if (Test-Path $lockFile) { exit 0 }

try {
    $data = $raw | ConvertFrom-Json -ErrorAction Stop
    $filePath = $data.tool_input.file_path

    if (-not $filePath) { exit 0 }

    # src/, server/ 내 .ts/.tsx/.js/.jsx 파일만 평가
    if ($filePath -notmatch '[/\\](src|server)[/\\]') { exit 0 }
    if ($filePath -notmatch '\.(ts|tsx|js|jsx)$') { exit 0 }

    # 락 파일 생성
    New-Item -ItemType File -Path $lockFile -Force | Out-Null

    try {
        $absPath = (Resolve-Path $filePath -ErrorAction Stop).Path

        $prompt = @"
You are an adversarial code reviewer. A junior AI just modified this file. Your job:

1. Read the file at: $absPath
2. Decide if it contains real issues: bugs, security holes, logic errors, off-by-one, async race conditions, null/undefined access, or TypeScript type errors.
   - For src/ files: also enforce AGENTS.md rules — generated React component code must not contain TypeScript syntax (type annotations, interfaces, generics, as-casts), import statements, or CSS files (inline styles only).
   - For server/ files: check CORS headers are not removed, API keys are not hardcoded, Provider type and ENV_KEYS stay in sync.
3. If LGTM: output exactly "LGTM" and make NO edits.
4. If issues found: fix them using the Edit tool, then output a brief explanation (1-2 sentences per fix, in Korean).

Be strict but surgical. Fix only real bugs — not style preferences or hypothetical issues.
"@

        $result = & claude -p $prompt --model claude-sonnet-4-6 --allowedTools "Read,Edit,MultiEdit" 2>&1

        if ($result -and ($result -join "`n") -notmatch '^LGTM') {
            @{
                hookSpecificOutput = @{
                    hookEventName     = "PostToolUse"
                    additionalContext = "[Evaluator (Sonnet)] $($result -join ' ')"
                }
            } | ConvertTo-Json -Compress
        }
    } finally {
        Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
    }
} catch {}
