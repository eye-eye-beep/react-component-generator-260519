import { stripCodeFences, ensureRenderCall, parseAnthropicSSELine, parseGoogleSSELine } from './utils';

const SYSTEM_PROMPT = `You are a React component generator. Generate a single React component based on the user's description.

Rules:
- Use inline styles only (no CSS imports, no CSS modules)
- Do NOT use import statements — React is already available in scope as a global
- Define the component as a function, then call render(<ComponentName />) at the end
- Make the component visually appealing with proper styling
- Use React hooks if needed (e.g., React.useState, React.useEffect)
- The component must be completely self-contained
- Respond with ONLY the code block — no explanations, no markdown fences
- Use descriptive variable names and clean formatting
- For colors, prefer modern palettes (gradients, shadows, etc.)
- Ensure the component is interactive where appropriate (hover states, click handlers, etc.)
- Do NOT use TypeScript syntax — no type annotations, no interfaces, no generics, no "as" casts. Write plain JavaScript only.

Example output format:
const GradientButton = () => {
  const [hovered, setHovered] = React.useState(false);

  return (
    <button
      style={{
        background: hovered
          ? 'linear-gradient(135deg, #667eea, #764ba2)'
          : 'linear-gradient(135deg, #764ba2, #667eea)',
        color: 'white',
        border: 'none',
        padding: '12px 24px',
        borderRadius: '8px',
        fontSize: '16px',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        transform: hovered ? 'scale(1.05)' : 'scale(1)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      Click me
    </button>
  );
};

render(<GradientButton />);`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

type Provider = 'anthropic' | 'google';

const ENV_KEYS: Record<Provider, string | undefined> = {
  anthropic: process.env.ANTHROPIC_API_KEY,
  google: process.env.GOOGLE_API_KEY,
};

function resolveApiKey(provider: Provider, clientKey?: string): string | null {
  return clientKey || ENV_KEYS[provider] || null;
}

async function callAnthropic(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (response.status === 429) {
    throw new Error('RATE_LIMIT_429');
  }
  if (response.status === 503) {
    throw new Error('SERVICE_UNAVAILABLE_503');
  }
  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };

  if (!Array.isArray(data.content)) {
    throw new Error('Invalid Anthropic API response: missing content array');
  }

  return data.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('');
}

async function callGoogle(prompt: string, apiKey: string): Promise<string> {
  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 8192 },
    }),
  });

  if (response.status === 429) {
    throw new Error('RATE_LIMIT_429');
  }
  if (response.status === 503) {
    throw new Error('SERVICE_UNAVAILABLE_503');
  }
  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content: { parts: Array<{ text?: string }> };
      finishReason?: string;
    }>;
  };

  const candidate = data.candidates?.[0];
  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw new Error('생성된 코드가 너무 길어 잘렸습니다. 더 간단한 컴포넌트를 요청해주세요.');
  }

  if (!candidate?.content?.parts || candidate.content.parts.length === 0) {
    throw new Error('Gemini API 응답이 비어있습니다. 다시 시도해주세요.');
  }

  return candidate.content.parts
    .map((part) => part.text ?? '')
    .join('');
}

async function* callAnthropicStream(prompt: string, apiKey: string): AsyncGenerator<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      stream: true,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (response.status === 429) throw new Error('RATE_LIMIT_429');
  if (response.status === 503) throw new Error('SERVICE_UNAVAILABLE_503');
  if (!response.ok) throw new Error(`Claude API error: ${response.status}`);
  if (!response.body) throw new Error('No response body from Anthropic');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const text = parseAnthropicSSELine(line.trim());
      if (text !== null) yield text;
    }
  }
  if (buffer) {
    const text = parseAnthropicSSELine(buffer.trim());
    if (text !== null) yield text;
  }
}

async function* callGoogleStream(prompt: string, apiKey: string): AsyncGenerator<string> {
  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 8192 },
    }),
  });

  if (response.status === 429) throw new Error('RATE_LIMIT_429');
  if (response.status === 503) throw new Error('SERVICE_UNAVAILABLE_503');
  if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
  if (!response.body) throw new Error('No response body from Gemini');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      // MAX_TOKENS 체크 (스트리밍 중 마지막 청크에 포함될 수 있음)
      if (trimmed.startsWith('data: ')) {
        try {
          const parsed = JSON.parse(trimmed.slice(6)) as {
            candidates?: Array<{ finishReason?: string }>;
          };
          if (parsed.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
            throw new Error('생성된 코드가 너무 길어 잘렸습니다. 더 간단한 컴포넌트를 요청해주세요.');
          }
        } catch (e) {
          if (e instanceof Error && e.message.includes('잘렸습니다')) throw e;
        }
      }
      const text = parseGoogleSSELine(trimmed);
      if (text !== null) yield text;
    }
  }
  if (buffer) {
    const text = parseGoogleSSELine(buffer.trim());
    if (text !== null) yield text;
  }
}

const SSE_HEADERS = {
  ...CORS_HEADERS,
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
};

const server = Bun.serve({
  port: 3002,
  async fetch(req) {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(req.url);

    if (req.method === 'GET' && url.pathname === '/api/config') {
      return Response.json(
        {
          envKeys: {
            anthropic: !!ENV_KEYS.anthropic,
            google: !!ENV_KEYS.google,
          },
        },
        { headers: CORS_HEADERS }
      );
    }

    if (req.method === 'POST' && url.pathname === '/api/generate') {
      try {
        const { prompt, apiKey, provider = 'anthropic', stream = false } = (await req.json()) as {
          prompt: string;
          apiKey?: string;
          provider?: Provider;
          stream?: boolean;
        };

        const resolvedKey = resolveApiKey(provider, apiKey);

        if (!resolvedKey) {
          return Response.json(
            { error: `API key is required. Set ${provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GOOGLE_API_KEY'} in .env or enter it manually.` },
            { status: 400, headers: CORS_HEADERS }
          );
        }

        if (!prompt) {
          return Response.json(
            { error: 'Prompt is required' },
            { status: 400, headers: CORS_HEADERS }
          );
        }

        if (!stream) {
          // 기존 비스트리밍 경로 — 그대로 유지
          const text =
            provider === 'google'
              ? await callGoogle(prompt, resolvedKey)
              : await callAnthropic(prompt, resolvedKey);

          const code = ensureRenderCall(stripCodeFences(text));
          return Response.json({ code }, { headers: CORS_HEADERS });
        }

        // 스트리밍 경로: SSE 응답 반환
        const generator =
          provider === 'google'
            ? callGoogleStream(prompt, resolvedKey)
            : callAnthropicStream(prompt, resolvedKey);

        let accumulated = '';
        const readable = new ReadableStream({
          async start(controller) {
            const encode = (s: string) => new TextEncoder().encode(s);
            try {
              for await (const chunk of generator) {
                accumulated += chunk;
                controller.enqueue(encode(`data: ${JSON.stringify({ type: 'delta', text: chunk })}\n\n`));
              }
              const code = ensureRenderCall(stripCodeFences(accumulated));
              controller.enqueue(encode(`data: ${JSON.stringify({ type: 'done', code })}\n\n`));
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Unknown error';
              const userMessage =
                message === 'RATE_LIMIT_429' ? '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' :
                message === 'SERVICE_UNAVAILABLE_503' ? 'API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.' :
                message;
              controller.enqueue(encode(`data: ${JSON.stringify({ type: 'error', error: userMessage })}\n\n`));
            } finally {
              controller.close();
            }
          },
        });

        return new Response(readable, { headers: SSE_HEADERS });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';

        if (message === 'RATE_LIMIT_429') {
          return Response.json(
            { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
            { status: 429, headers: CORS_HEADERS }
          );
        }

        if (message === 'SERVICE_UNAVAILABLE_503') {
          return Response.json(
            { error: 'API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.' },
            { status: 503, headers: CORS_HEADERS }
          );
        }

        return Response.json(
          { error: message },
          { status: 500, headers: CORS_HEADERS }
        );
      }
    }

    return Response.json(
      { error: 'Not found' },
      { status: 404, headers: CORS_HEADERS }
    );
  },
});

console.log(`API server running at http://localhost:${server.port}`);
