import type { ChatRequest, EmbedRequest } from "./types.js";

const ROLES = new Set(["system", "user", "assistant", "tool"]);

export function assertChatRequest(request: ChatRequest, model: string): void {
  if (!model.trim()) throw new Error("model is required");
  if (!Array.isArray(request.messages) || request.messages.length === 0) {
    throw new Error("messages must be a non-empty array");
  }
  for (const message of request.messages) {
    if (!ROLES.has(message.role)) {
      throw new Error(`Unsupported message role: ${message.role}`);
    }
    if (typeof message.content !== "string") {
      throw new Error("message content must be a string");
    }
  }
  if (request.temperature !== undefined && !Number.isFinite(request.temperature)) {
    throw new Error("temperature must be a finite number");
  }
  if (
    request.maxTokens !== undefined &&
    (!Number.isInteger(request.maxTokens) || request.maxTokens <= 0)
  ) {
    throw new Error("maxTokens must be a positive integer");
  }
}

export function embedInputs(input: EmbedRequest["input"]): string[] {
  const values = typeof input === "string" ? [input] : [...input];
  if (values.length === 0 || values.some((value) => typeof value !== "string" || value.length === 0)) {
    throw new Error("embed input must be a non-empty string or an array of non-empty strings");
  }
  return values;
}

export function assertEmbedRequest(request: EmbedRequest, model: string): string[] {
  if (!model.trim()) throw new Error("model is required");
  return embedInputs(request.input);
}
