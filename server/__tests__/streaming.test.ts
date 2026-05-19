import { describe, it, expect, mock, beforeEach } from 'bun:test';

// SSE 청크를 ReadableStream으로 변환하는 헬퍼
function makeSSEStream(lines: string[]): ReadableStream<Uint8Array> {
  const text = lines.join('');
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

// fetch를 모킹하고 스트리밍 응답을 시뮬레이션하는 헬퍼
function mockFetchStream(status: number, sseLines: string[]) {
  const body = status >= 200 && status < 300 ? makeSSEStream(sseLines) : null;
  global.fetch = mock(() =>
    Promise.resolve(
      new Response(body, {
        status,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    )
  );
}

function mockFetchJson(status: number, data: unknown) {
  global.fetch = mock(() =>
    Promise.resolve(
      new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    )
  );
}

// POST /api/generate 를 직접 호출하는 대신 서버 핸들러를 import하여 테스트
// 실제 Bun.serve 없이 라우트 로직만 테스트하기 위해
// callAnthropicStream / callGoogleStream을 직접 import하여 테스트
import { parseAnthropicSSELine, parseGoogleSSELine } from '../utils';

describe('Anthropic SSE 스트리밍 파서 통합', () => {
  it('여러 줄의 SSE 청크에서 텍스트를 순서대로 추출한다', () => {
    const lines = [
      'event: message_start\n',
      'data: {"type":"message_start","message":{}}\n\n',
      'event: content_block_start\n',
      'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
      'event: content_block_delta\n',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"const "}}\n\n',
      'event: content_block_delta\n',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Button"}}\n\n',
      'event: message_stop\n',
      'data: {"type":"message_stop"}\n\n',
    ];

    const results: string[] = [];
    for (const line of lines) {
      const text = parseAnthropicSSELine(line.trim());
      if (text !== null) results.push(text);
    }

    expect(results).toEqual(['const ', 'Button']);
  });

  it('ping 이벤트는 텍스트를 추출하지 않는다', () => {
    const line = 'data: {"type":"ping"}';
    expect(parseAnthropicSSELine(line)).toBeNull();
  });
});

describe('Google SSE 스트리밍 파서 통합', () => {
  it('여러 청크에서 텍스트를 순서대로 추출한다', () => {
    const lines = [
      'data: {"candidates":[{"content":{"parts":[{"text":"const "}],"role":"model"}}]}\n\n',
      'data: {"candidates":[{"content":{"parts":[{"text":"App"}],"role":"model"}}],"finishReason":"STOP"}\n\n',
    ];

    const results: string[] = [];
    for (const line of lines) {
      const text = parseGoogleSSELine(line.trim());
      if (text !== null) results.push(text);
    }

    expect(results).toEqual(['const ', 'App']);
  });

  it('finishReason이 있는 마지막 청크도 텍스트를 추출한다', () => {
    const line = 'data: {"candidates":[{"content":{"parts":[{"text":"done"}],"role":"model"},"finishReason":"STOP"}]}';
    expect(parseGoogleSSELine(line)).toBe('done');
  });
});

describe('SSE 버퍼 파싱 로직', () => {
  it('개행으로 분리된 줄에서 delta 텍스트만 수집한다', () => {
    const rawSSE = [
      'event: content_block_delta\n',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\n',
      'event: content_block_delta\n',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" World"}}\n\n',
      'event: message_stop\n',
      'data: {"type":"message_stop"}\n\n',
    ].join('');

    const collected: string[] = [];
    const lines = rawSSE.split('\n');
    for (const line of lines) {
      const text = parseAnthropicSSELine(line.trim());
      if (text !== null) collected.push(text);
    }

    expect(collected.join('')).toBe('Hello World');
  });
});
