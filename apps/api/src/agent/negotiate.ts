/**
 * Negociação de grupo: quando um endereço não encontra o tema, o coordenador tenta um tema comum
 * alternativo que exista em **todos** os endereços. É o passo "alinhar o tema ao que existe em
 * todos os endereços" da spec, dentro do coordenador — nenhum agente por dispositivo.
 *
 * Mecanismo determinístico: tenta temas candidatos em ordem e re-resolve **todos** os
 * participantes, para a decisão continuar compartilhada (tema comum + catálogos individuais).
 * Quando nenhum candidato fecha, devolve o resultado original — a contingência por participante
 * (`resolveOptionsWithFallback`) já cuidou do resto.
 */

import { resolveOptionsForParty, type PartyOptionsResult } from "./resolve-options.js";
import type { ResolveOptionsSettings } from "./resolve-options.js";
import { knownThemes } from "./themes.js";
import type { ResolveOptionsInput, ToolCaller } from "./types.js";

export interface NegotiationSettings extends ResolveOptionsSettings {
  /**
   * Temas candidatos, em ordem. Padrão: os temas conhecidos, menos o original. Um orquestrador com
   * LLM pode passar aqui o plano do modelo em vez da lista fixa.
   */
  alternatives?: string[];
}

export interface NegotiationOutcome {
  /** Tema final do grupo (o original, ou o alternativo que fechou). */
  theme: string;
  negotiated: boolean;
  results: PartyOptionsResult[];
}

function sameTheme(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export async function resolveOptionsForPartyWithNegotiation(
  requests: Array<{ input: ResolveOptionsInput; caller: ToolCaller }>,
  settings: NegotiationSettings = {},
): Promise<NegotiationOutcome> {
  const originalTheme = requests[0]?.input.theme ?? "";
  const initial = await resolveOptionsForParty(requests, settings);

  const stuck = initial.some((result) => result.status === "error" && result.code === "NO_OPTIONS");
  if (!stuck) {
    return { theme: originalTheme, negotiated: false, results: initial };
  }

  const alternatives =
    settings.alternatives ??
    knownThemes().filter((theme) => !sameTheme(theme, originalTheme));

  for (const theme of alternatives) {
    const attempt = await resolveOptionsForParty(
      requests.map((request) => ({ ...request, input: { ...request.input, theme } })),
      settings,
    );
    if (attempt.every((result) => result.status === "ok")) {
      return { theme, negotiated: true, results: attempt };
    }
  }

  return { theme: originalTheme, negotiated: false, results: initial };
}
