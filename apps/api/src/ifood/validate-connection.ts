import type { McpConnectionStatus } from "@sidequest/contracts";

import type { IfoodMcpClient } from "./client.js";

/**
 * Confirma que o token funciona com uma leitura sem efeitos colaterais (`getUser`).
 * Devolve só o status público: nunca nome, e-mail ou telefone.
 */
export async function validateConnection(
  client: Pick<IfoodMcpClient, "callTool">,
): Promise<Extract<McpConnectionStatus, "connected" | "error">> {
  try {
    const result = await client.callTool<{ success?: boolean }>("getUser");
    return result?.success === false ? "error" : "connected";
  } catch {
    return "error";
  }
}
