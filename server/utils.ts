export function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:jsx|tsx|javascript|typescript)?\n?/gm, '')
    .replace(/```\s*$/gm, '')
    .trim();
}

export function ensureRenderCall(code: string): string {
  if (/\brender\s*\(/.test(code)) return code;

  const match = code.match(/(?:const|function|export\s+(?:const|function))\s+([A-Z]\w+)/);
  if (match) {
    return `${code}\n\nrender(<${match[1]} />);`;
  }
  return code;
}

export function parseAnthropicSSELine(line: string): string | null {
  if (!line.startsWith('data: ')) return null;
  const json = line.slice(6).trim();
  if (!json || json === '[DONE]') return null;
  try {
    const parsed = JSON.parse(json) as {
      type?: string;
      delta?: { type?: string; text?: string };
    };
    if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
      return parsed.delta.text ?? '';
    }
    return null;
  } catch {
    return null;
  }
}

export function parseGoogleSSELine(line: string): string | null {
  if (!line.startsWith('data: ')) return null;
  const json = line.slice(6).trim();
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const candidate = parsed.candidates?.[0];
    if (!candidate?.content?.parts) return null;
    return candidate.content.parts.map((p) => p.text ?? '').join('');
  } catch {
    return null;
  }
}
