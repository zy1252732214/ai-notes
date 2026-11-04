import type { ChatMessage, TokenUsage, UsageRecord, UsageStore } from './types.js';

export function estimateTokens(text: string): number {
  if (!text) return 0;
  let units = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    units += code > 0xff ? 1 : 0.25;
  }
  return Math.max(1, Math.ceil(units));
}

export function estimatePromptTokens(messages: readonly ChatMessage[]): number {
  return estimateTokens(messages.map((message) => message.content).join('\n'));
}

export function usageFromCounts(
  provider: string,
  model: string,
  tokensIn: number | undefined,
  tokensOut: number | undefined,
  fallbackIn: number,
  fallbackOut: number,
): TokenUsage {
  const hasIn = typeof tokensIn === 'number' && Number.isFinite(tokensIn);
  const hasOut = typeof tokensOut === 'number' && Number.isFinite(tokensOut);
  const resolvedIn = hasIn ? Math.max(0, Math.trunc(tokensIn)) : fallbackIn;
  const resolvedOut = hasOut ? Math.max(0, Math.trunc(tokensOut)) : fallbackOut;
  return {
    provider,
    model,
    tokensIn: resolvedIn,
    tokensOut: resolvedOut,
    totalTokens: resolvedIn + resolvedOut,
    estimated: !hasIn || !hasOut,
  };
}

export function toUsageRecord(usage: TokenUsage, feature: string, now = new Date()): UsageRecord {
  return {
    date: now.toISOString().slice(0, 10),
    provider: usage.provider,
    model: usage.model,
    feature,
    tokensIn: usage.tokensIn,
    tokensOut: usage.tokensOut,
    estimated: usage.estimated,
  };
}

export class MemoryUsageStore implements UsageStore {
  readonly records: UsageRecord[] = [];

  record(usage: UsageRecord): void {
    this.records.push({ ...usage });
  }

  totals(): { tokensIn: number; tokensOut: number } {
    return this.records.reduce(
      (sum, record) => ({
        tokensIn: sum.tokensIn + record.tokensIn,
        tokensOut: sum.tokensOut + record.tokensOut,
      }),
      { tokensIn: 0, tokensOut: 0 },
    );
  }
}
