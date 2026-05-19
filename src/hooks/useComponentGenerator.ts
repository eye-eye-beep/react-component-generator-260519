import { useState, useCallback, useEffect } from 'react';
import type { GeneratedComponent, Provider } from '../types';

const STORAGE_KEY = 'rcg:components';

function loadFromStorage(): GeneratedComponent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as Array<Record<string, unknown>>).map((c) => ({
      id: c.id as string,
      prompt: c.prompt as string,
      code: c.code as string,
      createdAt: new Date(c.createdAt as string),
    }));
  } catch {
    return [];
  }
}

interface UseComponentGeneratorReturn {
  components: GeneratedComponent[];
  isLoading: boolean;
  error: string | null;
  streamingCode: string | null;
  generate: (prompt: string, apiKey: string | undefined, provider: Provider) => Promise<void>;
  removeComponent: (id: string) => void;
  clearAll: () => void;
}

export function useComponentGenerator(): UseComponentGeneratorReturn {
  const [components, setComponents] = useState<GeneratedComponent[]>(loadFromStorage);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingCode, setStreamingCode] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(components));
    } catch (err) {
      console.error('[RCG] localStorage save failed:', err);
    }
  }, [components]);

  const generate = useCallback(async (prompt: string, apiKey: string | undefined, provider: Provider) => {
    setIsLoading(true);
    setError(null);
    setStreamingCode('');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ...(apiKey && { apiKey }), provider, stream: true }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || 'Failed to generate component');
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalCode: string | null = null;

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(trimmed.slice(6)) as {
              type: string;
              text?: string;
              code?: string;
              error?: string;
            };
            if (event.type === 'delta' && event.text !== undefined) {
              setStreamingCode((prev) => (prev ?? '') + event.text);
            } else if (event.type === 'done' && event.code !== undefined) {
              finalCode = event.code;
              break outer;
            } else if (event.type === 'error') {
              throw new Error(event.error ?? 'Streaming error');
            }
          } catch (parseErr) {
            if (parseErr instanceof Error &&
                !parseErr.message.includes('JSON') &&
                parseErr.message !== 'Streaming error') {
              throw parseErr;
            }
          }
        }
      }

      if (finalCode !== null) {
        const newComponent: GeneratedComponent = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          prompt,
          code: finalCode,
          createdAt: new Date(),
        };
        setComponents((prev) => [newComponent, ...prev]);
      }
    } catch (err) {
      const message = err instanceof Error
        ? (err.name === 'AbortError' ? '요청 시간 초과. 다시 시도해주세요.' : err.message)
        : 'Unknown error';
      setError(message);
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
      setStreamingCode(null);
    }
  }, []);

  const removeComponent = useCallback((id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setComponents([]);
  }, []);

  return { components, isLoading, error, streamingCode, generate, removeComponent, clearAll };
}
