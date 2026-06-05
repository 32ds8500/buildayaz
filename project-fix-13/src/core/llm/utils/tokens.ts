const CHARS_PER_TOKEN = 3.5;
export const estimateTokens = (text: string) => Math.ceil(text.length / CHARS_PER_TOKEN);
export const estimateMessageTokens = (msgs: { content: string }[]) =>
  msgs.reduce((s, m) => s + estimateTokens(m.content) + 4, 2);

export function trimMessagesToContext(
  messages: { role: string; content: string }[],
  contextWindow: number,
  reserveOutput = 1024,
): { role: string; content: string }[] {
  const maxInput = contextWindow - reserveOutput;
  const system = messages.find(m => m.role === 'system');
  const rest = messages.filter(m => m.role !== 'system');
  let used = system ? estimateTokens(system.content) + 4 : 0;
  const result: typeof messages = [];
  for (let i = rest.length - 1; i >= 0; i--) {
    const t = estimateTokens(rest[i].content) + 4;
    if (used + t > maxInput) break;
    result.unshift(rest[i]);
    used += t;
  }
  return system ? [system, ...result] : result;
}
