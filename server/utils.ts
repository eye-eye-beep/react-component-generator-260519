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
