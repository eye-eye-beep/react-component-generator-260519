import { describe, it, expect } from 'bun:test';
import { stripCodeFences, ensureRenderCall, parseAnthropicSSELine, parseGoogleSSELine } from '../utils';

describe('stripCodeFences', () => {
  it('jsx 코드 펜스를 제거한다', () => {
    expect(stripCodeFences('```jsx\nconst A = () => <div/>;\n```')).toBe('const A = () => <div/>;');
  });

  it('펜스 없는 코드는 그대로 반환한다', () => {
    expect(stripCodeFences('const A = () => <div/>;')).toBe('const A = () => <div/>;');
  });
});

describe('ensureRenderCall', () => {
  it('render() 없으면 자동 추가한다', () => {
    const code = 'const Button = () => <button/>;';
    expect(ensureRenderCall(code)).toBe('const Button = () => <button/>;\n\nrender(<Button />);');
  });

  it('render() 있으면 그대로 반환한다', () => {
    const code = 'const Button = () => <button/>;\nrender(<Button />);';
    expect(ensureRenderCall(code)).toBe(code);
  });
});

describe('parseAnthropicSSELine', () => {
  it('content_block_delta 이벤트에서 텍스트를 추출한다', () => {
    const line = 'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"const "}}';
    expect(parseAnthropicSSELine(line)).toBe('const ');
  });

  it('빈 텍스트 delta는 빈 문자열을 반환한다', () => {
    const line = 'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":""}}';
    expect(parseAnthropicSSELine(line)).toBe('');
  });

  it('message_start 이벤트는 null을 반환한다', () => {
    const line = 'data: {"type":"message_start","message":{}}';
    expect(parseAnthropicSSELine(line)).toBeNull();
  });

  it('message_stop 이벤트는 null을 반환한다', () => {
    const line = 'data: {"type":"message_stop"}';
    expect(parseAnthropicSSELine(line)).toBeNull();
  });

  it('content_block_stop 이벤트는 null을 반환한다', () => {
    const line = 'data: {"type":"content_block_stop","index":0}';
    expect(parseAnthropicSSELine(line)).toBeNull();
  });

  it('data: 접두어 없는 줄은 null을 반환한다', () => {
    expect(parseAnthropicSSELine('event: content_block_delta')).toBeNull();
  });

  it('빈 줄은 null을 반환한다', () => {
    expect(parseAnthropicSSELine('')).toBeNull();
  });

  it('[DONE] 신호는 null을 반환한다', () => {
    expect(parseAnthropicSSELine('data: [DONE]')).toBeNull();
  });

  it('잘못된 JSON은 null을 반환한다', () => {
    expect(parseAnthropicSSELine('data: {invalid json')).toBeNull();
  });

  it('text_delta가 아닌 delta 타입은 null을 반환한다', () => {
    const line = 'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{}"}}';
    expect(parseAnthropicSSELine(line)).toBeNull();
  });
});

describe('parseGoogleSSELine', () => {
  it('candidates 배열에서 텍스트를 추출한다', () => {
    const line = 'data: {"candidates":[{"content":{"parts":[{"text":"Button"}],"role":"model"}}]}';
    expect(parseGoogleSSELine(line)).toBe('Button');
  });

  it('parts가 여러 개면 모두 이어붙인다', () => {
    const line = 'data: {"candidates":[{"content":{"parts":[{"text":"const "},{"text":"App"}],"role":"model"}}]}';
    expect(parseGoogleSSELine(line)).toBe('const App');
  });

  it('text 없는 part는 빈 문자열로 처리한다', () => {
    const line = 'data: {"candidates":[{"content":{"parts":[{}],"role":"model"}}]}';
    expect(parseGoogleSSELine(line)).toBe('');
  });

  it('candidates 없는 응답은 null을 반환한다', () => {
    const line = 'data: {"usageMetadata":{"promptTokenCount":10}}';
    expect(parseGoogleSSELine(line)).toBeNull();
  });

  it('빈 candidates 배열은 null을 반환한다', () => {
    const line = 'data: {"candidates":[]}';
    expect(parseGoogleSSELine(line)).toBeNull();
  });

  it('data: 접두어 없는 줄은 null을 반환한다', () => {
    expect(parseGoogleSSELine('event: something')).toBeNull();
  });

  it('빈 줄은 null을 반환한다', () => {
    expect(parseGoogleSSELine('')).toBeNull();
  });

  it('잘못된 JSON은 null을 반환한다', () => {
    expect(parseGoogleSSELine('data: {invalid')).toBeNull();
  });
});
