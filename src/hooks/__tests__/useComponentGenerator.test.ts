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

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

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

    act(() => {
      result.current.removeComponent('id-1');
    });

    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? '[]'
    ) as Array<Record<string, unknown>>;
    expect(saved).toHaveLength(1);
    expect((saved[0] as Record<string, unknown>).id).toBe('id-2');
  });

  it('clearAll() 후 localStorage가 빈 배열로 저장된다', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([makeComponent()]));

    const { result } = renderHook(() => useComponentGenerator());

    act(() => {
      result.current.clearAll();
    });

    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? '[]'
    ) as Array<Record<string, unknown>>;
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
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ code: 'render(<div>Generated</div>)' }),
      })
    );

    const { result } = renderHook(() => useComponentGenerator());

    await act(async () => {
      await result.current.generate('테스트 프롬프트', 'test-key', 'anthropic');
    });

    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? '[]'
    ) as Array<Record<string, unknown>>;
    expect(saved).toHaveLength(1);
    expect((saved[0] as Record<string, unknown>).prompt).toBe('테스트 프롬프트');
    expect((saved[0] as Record<string, unknown>).code).toBe('render(<div>Generated</div>)');
  });
});
