# AGENTS.md — React Component Generator

## Operational Commands

패키지 매니저: **bun 고정** — npm, yarn, pnpm 절대 사용 금지.

```bash
bun install                 # 의존성 설치
bun run dev                 # 서버 + 프론트엔드 동시 실행 (포트 3002 + Vite)
bun run server              # Bun API 서버만 실행 (--watch 모드, 포트 3002)
vite                        # Vite 개발 서버만 실행
bun run build               # 타입 체크 + Vite 빌드
bun run lint                # ESLint 검사
bun run preview             # 프로덕션 빌드 로컬 미리보기
```

## Golden Rules

**절대 금지 (Immutable):**
- API 키를 소스 코드에 하드코딩하지 마라. 항상 `.env` 또는 클라이언트 UI 입력을 통해 처리한다.
- `server/index.ts`의 CORS 헤더를 제거하거나 특정 오리진으로 제한하지 마라 — 로컬 개발 환경이 깨진다.
- `render(<ComponentName />)` 호출 없이 AI 생성 코드를 react-live에 넘기지 마라.
- `ENV_KEYS` 객체 외부에서 `process.env`를 직접 참조하지 마라.

**Do's:**
- 새 AI 프로바이더 추가 시 반드시 `server/index.ts`의 `Provider` 타입과 `ENV_KEYS`를 동시에 갱신한다.
- 생성된 컴포넌트 코드는 항상 `stripCodeFences` → `ensureRenderCall` 순으로 후처리한다.
- 프론트엔드와 서버 양쪽에 `Provider` 타입이 존재하므로, 변경 시 `src/types/index.ts`와 `server/index.ts` 모두 수정한다.

**Don'ts:**
- 생성된 React 컴포넌트에 TypeScript 문법(타입 어노테이션, 인터페이스, 제네릭, `as` 캐스트)을 허용하지 마라 — react-live가 런타임에서 실행하므로 파싱 오류가 발생한다.
- `import` 문을 생성된 컴포넌트 코드에 포함하지 마라 — React는 전역 스코프에서 이미 사용 가능하다.
- CSS 파일 또는 CSS 모듈을 생성된 컴포넌트에 사용하지 마라. 인라인 스타일만 허용한다.

## Project Context

AI 프롬프트로 React 컴포넌트를 실시간 생성·미리보기하는 웹 앱.

Tech Stack: React 19, TypeScript, Vite, Bun, react-live, Anthropic Claude API, Google Gemini API

## Standards

**커밋 메시지:** `type: 설명` 형식 (한국어 허용)
- type: `feat`, `fix`, `refactor`, `chore`, `docs`
- 예: `feat: Gemini 2.5 Pro 모델 지원 추가`

**TypeScript:**
- 프론트엔드(`src/`)와 서버(`server/`)는 각각 별도 tsconfig를 사용한다.
- `any` 타입 사용 금지. 알 수 없는 외부 응답에는 타입 어설션과 타입 가드를 사용한다.

**Maintenance Policy:** 이 파일의 규칙이 실제 코드와 어긋나면 수정을 제안하라.

## Context Map

- **[프론트엔드 컴포넌트/훅 수정 (src/)](./src/AGENTS.md)** — React 컴포넌트, 커스텀 훅, 타입 정의, react-live 관련 작업 시.
- **[Bun API 서버 수정 (server/)](./server/AGENTS.md)** — AI 프로바이더 연동, 라우트 핸들러, 시스템 프롬프트 수정 시.
