import type { PlatformId } from "@reponix/schemas";
import type { PlatformAdapter } from "./adapter.js";
import { ClaudeAdapter } from "./claude.js";
import { GeminiAdapter } from "./gemini.js";
import { CursorAdapter } from "./cursor.js";
import { OpenCodeAdapter } from "./opencode.js";
import { CopilotAdapter } from "./copilot.js";
import { CodexAdapter } from "./codex.js";

export * from "./adapter.js";
export * from "./claude.js";
export * from "./gemini.js";
export * from "./cursor.js";
export * from "./opencode.js";
export * from "./copilot.js";
export * from "./codex.js";

export function getAllAdapters(): PlatformAdapter[] {
  return [
    new ClaudeAdapter(),
    new GeminiAdapter(),
    new CursorAdapter(),
    new OpenCodeAdapter(),
    new CopilotAdapter(),
    new CodexAdapter(),
  ];
}

export function getAdapter(platformId: PlatformId): PlatformAdapter {
  const adapters = getAllAdapters();
  const match = adapters.find((a) => a.platformId === platformId);
  if (!match) {
    throw new Error(`Unsupported platform adapter: ${platformId}`);
  }
  return match;
}

export async function detectPlatform(rootDir: string): Promise<PlatformAdapter | undefined> {
  const adapters = getAllAdapters();
  for (const adapter of adapters) {
    if (await adapter.detect(rootDir)) {
      return adapter;
    }
  }
  return undefined;
}
