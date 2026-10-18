import type { McpConnectionStatus } from "@sidequest/contracts";

import type { IfoodMcpClient } from "./client.js";

export interface ConnectionValidation {
  status: Extract<McpConnectionStatus, "connected" | "error">;
  /**
   * Nome de exibição (`fullName`) do `getUser`, quando o escopo permitir. É o único dado
   * pessoal que sai daqui: e-mail e telefone nunca são propagados.
   */
  name?: string;
}

interface UserProfileEnvelope {
  success?: boolean;
  data?: { fullName?: unknown };
}

/**
 * Confirma que o token funciona com uma leitura sem efeitos colaterais (`getUser`) e aproveita
 * a resposta para descobrir o nome que o participante já tem no iFood — o front não pergunta.
 */
export async function validateConnection(
  client: Pick<IfoodMcpClient, "callTool">,
): Promise<ConnectionValidation> {
  try {
    const result = await client.callTool<UserProfileEnvelope>("getUser");
    if (result?.success === false) return { status: "error" };

    const fullName = typeof result?.data?.fullName === "string" ? result.data.fullName.trim() : "";
    return {
      status: "connected",
      ...(fullName ? { name: fullName.slice(0, 80) } : {}),
    };
  } catch {
    return { status: "error" };
  }
}
