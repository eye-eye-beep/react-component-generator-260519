# AGENTS.md — server/ (Bun API 서버)

## Module Context

Bun HTTP 서버. 프론트엔드의 AI 요청을 받아 Anthropic 또는 Google API로 중계하고, 생성된 코드를 후처리하여 반환한다. 포트 3002에서 실행.

## Tech Stack & Constraints

- **런타임**: Bun 전용 — `Bun.serve()`, `process.env` 사용. Node.js `http`/`express` 사용 금지.
- **의존성**: 서버 전용 패키지 설치 금지. 외부 HTTP 요청은 `fetch`(Bun 내장)만 사용한다.
- **AI SDK**: 공식 SDK(`@anthropic-ai/sdk`, `@google/generative-ai`) 임포트 금지 — 현재 구조는 직접 REST API 호출 방식.

## Implementation Patterns

**새 AI 프로바이더 추가 시 필수 순서:**
1. `Provider` 타입에 새 값 추가
2. `ENV_KEYS`에 환경변수 키 추가
3. `callProviderName()` 함수 구현 (반환: `Promise<string>`)
4. `/api/generate` 라우트의 분기 로직에 추가
5. `src/types/index.ts`의 `Provider` 타입 동기화

**시스템 프롬프트 수정:**
- `SYSTEM_PROMPT` 상수만 수정한다.
- 핵심 제약 3가지는 반드시 유지: 인라인 스타일만, `import` 금지, `render()` 호출 필수.

**코드 후처리 파이프라인:**
```
AI 응답 텍스트 → stripCodeFences() → ensureRenderCall() → 클라이언트 반환
```

**API 키 우선순위:** 클라이언트 전달 키 > `.env` 키 (이 순서 변경 금지)

## Local Golden Rules

**Do's:**
- 모든 라우트 응답에 `CORS_HEADERS`를 포함시킨다.
- AI API 에러는 HTTP 상태 코드로 구분하여 적절한 한국어 메시지와 함께 반환한다 (429, 503 등).
- `ensureRenderCall`은 `const`/`function`으로 시작하는 PascalCase 이름의 컴포넌트를 자동 감지한다 — 패턴 변경 시 정규식 확인 필수.

**Don'ts:**
- `resolveApiKey` 함수를 우회하여 직접 `process.env`를 참조하지 마라.
- `/api/config` 응답에 실제 API 키 값을 포함하지 마라 — 키 존재 여부(`boolean`)만 반환한다.
- Bun 서버를 멀티 포트로 분리하지 마라 — 단일 포트(3002)에서 모든 라우트 처리.
- 스트리밍 응답을 구현할 경우, `react-live`가 완성된 코드 블록을 필요로 하므로 프론트엔드 처리 방식도 함께 변경해야 한다.
