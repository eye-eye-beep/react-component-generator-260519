import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useComponentGenerator } from '../useComponentGenerator';
import type { GeneratedComponent } from '../../types';

const STORAGE_KEY = 'rcg:components';

function makeComponent(overrides: Partial<GeneratedComponent> = {}): GeneratedComponent {
  return {
    id: 'test-id',
    prompt: '버튼 컴포넌트',
    code: 'render(<button>Click</button>)',
    createdAt: new Date('2024-01-01T12:00:00.000Z'),
    ...overrides,
  };
}

function makeSSEResponse(events: Array<Record<string, unknown>>) {
  const sseText = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
  const encoder = new TextEncoder();
  let sent = false;
  const mockReader = {
    read: vi.fn().mockImplementation(async () => {
      if (!sent) { sent = true; return { done: false, value: encoder.encode(sseText) }; }
      return { done: true, value: undefined };
    }),
    cancel: vi.fn(),
  };
  return { ok: true, body: { getReader: () => mockReader } };
}

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('useComponentGenerator — localStorage 영속화', () => {
  it('초기화 시 localStorage에 저장된 컴포넌트 배열을 로드한다', () => {
    const stored = [makeComponent()];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    const { result } = renderHook(() => useComponentGenerator());
    expect(result.current.components).toHaveLength(1);
    expect(result.current.components[0].id).toBe('test-id');
  });

  it('localStorage에서 불러온 createdAt이 Date 객체로 복원된다', () => {
    const stored = [makeComponent({ createdAt: new Date('2024-06-15T09:30:00.000Z') })];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    const { result } = renderHook(() => useComponentGenerator());
    expect(result.current.components[0].createdAt).toBeInstanceOf(Date);
    expect(result.current.components[0].createdAt.toISOString()).toBe('2024-06-15T09:30:00.000Z');
  });

  it('removeComponent() 후 업데이트된 배열이 localStorage에 저장된다', () => {
    const comp1 = makeComponent({ id: 'id-1' });
    const comp2 = makeComponent({ id: 'id-2' });
    localStorage.setItem(STORAGE_KEY, JSON.stringify([comp1, comp2]));
    const { result } = renderHook(() => useComponentGenerator());
    act(() => { result.current.removeComponent('id-1'); });
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Array<Record<string, unknown>>;
    expect(saved).toHaveLength(1);
    expect((saved[0] as Record<string, unknown>).id).toBe('id-2');
  });

  it('clearAll() 후 localStorage가 빈 배열로 저장된다', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([makeComponent()]));
    const { result } = renderHook(() => useComponentGenerator());
    act(() => { result.current.clearAll(); });
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Array<Record<string, unknown>>;
    expect(saved).toEqual([]);
  });

  it('localStorage에 손상된 JSON이 있을 때 빈 배열로 초기화된다', () => {
    localStorage.setItem(STORAGE_KEY, 'invalid-json{{{');
    const { result } = renderHook(() => useComponentGenerator());
    expect(result.current.components).toEqual([]);
  });

  it('localStorage가 비어있을 때 빈 배열로 초기화된다', () => {
    const { result } = renderHook(() => useComponentGenerator());
    expect(result.current.components).toEqual([]);
  });

  it('generate() 후 새 컴포넌트가 localStorage에 자동 저장된다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      makeSSEResponse([
        { type: 'delta', text: 'render(<div>Generated</div>)' },
        { type: 'done', code: 'render(<div>Generated</div>)' },
      ])
    ));
    const { result } = renderHook(() => useComponentGenerator());
    await act(async () => { await result.current.generate('테스트 프롬프트', 'test-key', 'anthropic'); });
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Array<Record<string, unknown>>;
    expect(saved).toHaveLength(1);
    expect((saved[0] as Record<string, unknown>).prompt).toBe('테스트 프롬프트');
    expect((saved[0] as Record<string, unknown>).code).toBe('render(<div>Generated</div>)');
  });
});

describe('useComponentGenerator — 요청 타임아웃 (evaluator 이슈 #6)', () => {
  it('정상 응답은 타임아웃 전에 완료되면 저장된다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      makeSSEResponse([
        { type: 'delta', text: 'render(<div>OK</div>)' },
        { type: 'done', code: 'render(<div>OK</div>)' },
      ])
    ));
    const { result } = renderHook(() => useComponentGenerator());
    await act(async () => { await result.current.generate('프롬프트', 'key', 'anthropic'); });
    expect(result.current.components).toHaveLength(1);
    expect(result.current.error).toBe(null);
  });

  it('API 에러 응답도 정상 처리된다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: false, body: null,
      json: async () => ({ error: 'API 키 오류' }),
    }));
    const { result } = renderHook(() => useComponentGenerator());
    await act(async () => { await result.current.generate('프롬프트', 'bad-key', 'anthropic'); });
    expect(result.current.error).toBe('API 키 오류');
    expect(result.current.isLoading).toBe(false);
  });

  it('AbortError는 타임아웃 메시지로 변환된다', async () => {
    const abortError = new Error('The operation was aborted.');
    Object.defineProperty(abortError, 'name', { value: 'AbortError' });
    vi.stubGlobal('fetch', vi.fn(() => { throw abortError; }));
    const { result } = renderHook(() => useComponentGenerator());
    await act(async () => { await result.current.generate('프롬프트', 'key', 'anthropic'); });
    expect(result.current.error).toBe('요청 시간 초과. 다시 시도해주세요.');
    expect(result.current.isLoading).toBe(false);
  });
});

describe('useComponentGenerator — 스트리밍', () => {
  it('초기 streamingCode는 null이다', () => {
    const { result } = renderHook(() => useComponentGenerator());
    expect(result.current.streamingCode).toBeNull();
  });

  it('delta 이벤트가 도착할 때마다 streamingCode가 누적되고 완료 후 components에 추가된다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      makeSSEResponse([
        { type: 'delta', text: 'const ' },
        { type: 'delta', text: 'Button' },
        { type: 'delta', text: ' = () => <button/>;' },
        { type: 'done', code: 'const Button = () => <button/>;' },
      ])
    ));
    const { result } = renderHook(() => useComponentGenerator());
    await act(async () => { await result.current.generate('버튼', 'key', 'anthropic'); });
    expect(result.current.streamingCode).toBeNull();
    expect(result.current.components).toHaveLength(1);
    expect(result.current.components[0].code).toBe('const Button = () => <button/>;');
  });

  it('스트리밍 완료 후 streamingCode가 null로 리셋된다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      makeSSEResponse([{ type: 'done', code: 'render(<div/>)' }])
    ));
    const { result } = renderHook(() => useComponentGenerator());
    await act(async () => { await result.current.generate('프롬프트', 'key', 'anthropic'); });
    expect(result.current.streamingCode).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('SSE error 이벤트 수신 시 error 상태가 설정되고 streamingCode가 null로 리셋된다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      makeSSEResponse([
        { type: 'delta', text: '일부 코드' },
        { type: 'error', error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
      ])
    ));
    const { result } = renderHook(() => useComponentGenerator());
    await act(async () => { await result.current.generate('프롬프트', 'key', 'anthropic'); });
    expect(result.current.error).toBe('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
    expect(result.current.streamingCode).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.components).toHaveLength(0);
  });

  it('fetch 요청 body에 stream: true가 포함된다', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      makeSSEResponse([{ type: 'done', code: 'render(<div/>)' }])
    );
    vi.stubGlobal('fetch', mockFetch);
    const { result } = renderHook(() => useComponentGenerator());
    await act(async () => { await result.current.generate('테스트', 'key', 'google'); });
    expect(mockFetch).toHaveBeenCalledWith('/api/generate', expect.objectContaining({
      body: expect.stringContaining('"stream":true'),
    }));
  });
});
