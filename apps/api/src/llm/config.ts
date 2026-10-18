/**
 * Configuração do provedor de LLM (opencode Console), lida somente do ambiente.
 *
 * A chave é do sistema e é **opcional**: sem `OPENCODE_API_KEY` o agente cai no pipeline
 * determinístico, exatamente como o B11 exige ("com e sem LLM o resultado é válido"). O endpoint é
 * OpenAI-compatible. Ver docs/superpowers/specs/2026-10-17-agente-llm-ifood-mcp.md.
 */

export const DEFAULT_OPENCODE_BASE_URL = "https://opencode.ai/inference";
export const DEFAULT_OPENCODE_MODEL = "deepseek-v4.1-flash";
export const OPENAI_COMPATIBLE_CHAT_PATH = "/openai/v1/chat/completions";

export interface OpenCodeConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  chatCompletionsUrl: string;
  /**
   * ID estável da conversa, enviado como `x-opencode-session`. O endpoint do plano Go
   * (`/inference/go`) exige esse header para rotear; sem ele responde `400 MissingSessionID`.
   */
  sessionId?: string;
}

type Env = Record<string, string | undefined>;

function read(env: Env, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

function withoutTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** `undefined` quando não há chave: o agente permanece determinístico. */
export function loadOpenCodeConfig(env: Env = process.env): OpenCodeConfig | undefined {
  const apiKey = read(env, "OPENCODE_API_KEY");
  if (!apiKey) return undefined;

  const baseUrl = withoutTrailingSlash(read(env, "OPENCODE_BASE_URL") ?? DEFAULT_OPENCODE_BASE_URL);
  const sessionId = read(env, "OPENCODE_SESSION_ID");

  return {
    apiKey,
    model: read(env, "OPENCODE_MODEL") ?? DEFAULT_OPENCODE_MODEL,
    baseUrl,
    chatCompletionsUrl: `${baseUrl}${OPENAI_COMPATIBLE_CHAT_PATH}`,
    ...(sessionId ? { sessionId } : {}),
  };
}
