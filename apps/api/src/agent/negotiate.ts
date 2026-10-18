/**
 * Negociação de grupo: quando um endereço não encontra o tema, o coordenador tenta um tema comum
 * alternativo que exista em **todos** os endereços. É o passo "alinhar o tema ao que existe em
 * todos os endereços" da spec, dentro do coordenador — nenhum agente por dispositivo.
 *
 * Mecanismo determinístico: tenta temas candidatos em ordem e re-resolve **todos** os
 * participantes, para a decisão continuar compartilhada (tema comum + catálogos individuais).
 * O último candidato é sempre a "vibe" do dia, que o agente consegue buscar em qualquer endereço.
 * Quando nem isso fecha, devolve o resultado original — a contingência por participante
 * (`resolveOptionsWithFallback`) já cuidou do resto.
 *
 * O `resolve` é injetável: passe `(input, caller) => resolveOptionsPreferringPlanner(...)` para a
 * negociação respeitar o planner LLM; sem ele, cai no determinístico.
 */

import { vibeTheme } from "../party/theme.js";
import {
  resolveOptionsForParty,
  type PartyOptionResolver,
  type PartyOptionsResult,
} from "./resolve-options.js";
import type { ResolveOptionsSettings } from "./resolve-options.js";
import { knownThemes } from "./themes.js";
import type { ResolveOptionsInput, ToolCaller } from "./types.js";

export interface NegotiationSettings extends ResolveOptionsSettings {
  /**
   * Temas candidatos, em ordem. Padrão: os temas conhecidos menos o original, com a vibe do dia
   * por último. Um orquestrador com LLM pode passar aqui o plano do modelo em vez da lista fixa.
   */
  alternatives?: string[];
  /** Data de referência da vibe; injetável para teste. */
  now?: Date;
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
  resolve?: PartyOptionResolver,
): Promise<NegotiationOutcome> {
  const originalTheme = requests[0]?.input.theme ?? "";
  const initial = await resolveOptionsForParty(requests, settings, resolve);

  const stuck = initial.some((result) => result.status === "error" && result.code === "NO_OPTIONS");
  if (!stuck) {
    return { theme: originalTheme, negotiated: false, results: initial };
  }

  const alternatives =
    settings.alternatives ??
    [
      ...knownThemes().filter((theme) => !sameTheme(theme, originalTheme)),
      vibeTheme(settings.now),
    ];

  for (const theme of alternatives) {
    if (sameTheme(theme, originalTheme)) continue;
    const attempt = await resolveOptionsForParty(
      requests.map((request) => ({ ...request, input: { ...request.input, theme } })),
      settings,
      resolve,
    );
    if (attempt.every((result) => result.status === "ok")) {
      return { theme, negotiated: true, results: attempt };
    }
  }

  return { theme: originalTheme, negotiated: false, results: initial };
}
