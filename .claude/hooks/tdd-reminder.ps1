param()
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$raw = [Console]::In.ReadToEnd()
try {
    $data = $raw | ConvertFrom-Json
    $filePath = $data.tool_input.file_path
    if ($filePath -match '[/\\]src[/\\]') {
        @{
            hookSpecificOutput = @{
                hookEventName   = "PostToolUse"
                additionalContext = "[TDD 리마인더] src/ 파일이 수정되었습니다.`nRED→GREEN→REFACTOR 사이클을 지키세요:`n- RED  : 실패하는 테스트 먼저 작성 → bun run test로 FAIL 확인`n- GREEN: 테스트를 통과하는 최소 코드만 작성`n- REFACTOR: 중복 제거 (새 기능 추가 금지)`n⚠️ 구현 코드보다 테스트가 항상 먼저입니다."
            }
        } | ConvertTo-Json -Compress
    }
} catch {}
