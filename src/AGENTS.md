# AGENTS.md — src/ (프론트엔드)

## Module Context

React 19 + TypeScript + Vite 기반 프론트엔드. 사용자 입력 수집, AI API 호출 중계, react-live를 통한 런타임 컴포넌트 렌더링을 담당한다.

## Tech Stack & Constraints

- **react-live**: 생성된 컴포넌트를 런타임에 실행. 코드에 TypeScript 문법, `import` 문 포함 시 런타임 파싱 오류 발생.
- **상태 관리**: 외부 라이브러리(Redux, Zustand 등) 금지. `useState`/`useReducer` + 커스텀 훅으로 처리한다.
- **스타일링**: Tailwind/CSS-in-JS 금지. 인라인 스타일 또는 일반 CSS만 사용한다.

## Implementation Patterns

**새 컴포넌트 추가:**
1. `src/components/ComponentName.tsx` 생성
2. `App.tsx`에서 import하여 사용

**커스텀 훅:**
- `src/hooks/` 위치. `use` 접두사 필수.
- 상태 타입은 `src/types/index.ts`에서 가져온다.

**타입 정의:**
- 공유 타입은 `src/types/index.ts`에만 정의한다.
- `Provider` 타입 변경 시 `server/index.ts`도 반드시 동기화한다.

**API 호출:**
- 모든 AI 생성 요청은 `/api/generate`로 POST — 직접 외부 AI API를 호출하지 마라.
- API 키는 `useComponentGenerator` 훅에서 상위로 전달받아 서버로 넘긴다.

## Local Golden Rules

**Do's:**
- `LivePreview`에 전달하는 코드는 반드시 서버 응답을 그대로 사용한다 (`stripCodeFences`, `ensureRenderCall`은 서버에서 처리 완료).
- `ComponentCard`에서 코드 편집 기능 구현 시, 편집된 코드를 react-live `LiveProvider`의 `code` prop에 직접 바인딩한다.
- 에러 상태는 `useComponentGenerator`의 `error` 필드를 통해 단일 지점에서 관리한다.

**Don'ts:**
- `LivePreview` 내부에서 추가 fetch나 상태 관리를 하지 마라 — 순수 렌더링 컴포넌트로 유지한다.
- `App.tsx`에 비즈니스 로직을 직접 작성하지 마라. 훅으로 추출한다.
- API 키를 컴포넌트 상태나 로컬 스토리지에 영구 저장하지 마라 (세션 내 임시 보관만 허용).
