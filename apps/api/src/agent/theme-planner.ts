/**
 * Planner de tema: o agente escolhe o tema da Party a partir das respostas de **todos** os
 * participantes, em vez da tabela determinística de `party/theme.ts`.
 *
 * Diferença de comportamento:
 * - `deriveTheme` mescla as respostas (`Object.assign`) e aplica regras fixas;
 * - aqui o modelo vê cada participante separadamente e pondera divergências (ex.: um quer leve,
 *   dois querem comfort food → italiano).
 *
 * A saída é validada contra o catálogo de `themes.ts`. Se o modelo inventar um tema, o reveal
 * mantém o determinístico: nunca gravamos um tema que a busca não sabe resolver.
 */

import type { ChatClient, ChatMessage } from "../llm/client.js";
import type { Answers, ThemePlan, ThemePlanner } from "../party/theme-plan.js";
import { knownThemes } from "./themes.js";

export interface LlmThemePlannerSettings {
  /** Teto de espera do modelo; estourou, o reveal cai no determinístico. */
  timeoutMs?: number;
}

export const DEFAULT_THEME_PLANNER_TIMEOUT_MS = 10_000;

/**
 * Respostas que o modelo pode ver. `address` fica de fora (dado pessoal/de entrega) e
 * `*__value` é só o valor monetário que o front envia — o orçamento já vai pelo enum.
 */
const THEME_ANSWER_KEYS = new Set([
  "restrictions",
  "restrictions__other",
  "budget",
  "energy",
  "order-style",
  "cravings",
  "exclusions",
  "exclusions__other",
]);

/**
 * Sinônimos aceitos na saída do modelo. A chave já vem normalizada (sem acento, minúscula);
 * o valor é o tema canônico do catálogo.
 */
const THEME_ALIASES: Record<string, string> = {
  italiana: "italiano",
  japonesa: "japones",
  "comida japonesa": "japones",
  hamburgueres: "hamburguer",
  hamburguer: "hamburguer",
  sanduiche: "hamburguer",
  mexicana: "mexicano",
  brasileira: "brasileiro",
  arabe: "arabe",
  saudavel: "saudavel",
  fitness: "saudavel",
  doces: "doce",
  sobremesa: "doce",
};

/** Normalização canônica: sem acento, sem espaços nas pontas, minúscula. */
export function normalizeThemeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/** Converte a sugestão do modelo em um tema do catálogo; `undefined` se não houver match. */
export function normalizeThemeCandidate(
  raw: unknown,
  allowed: string[] = knownThemes(),
): string | undefined {
  if (typeof raw !== "string") return undefined;
  const key = normalizeThemeKey(raw);
  if (!key) return undefined;

  const alias = THEME_ALIASES[key];
  if (alias && allowed.includes(alias)) return alias;
  if (allowed.includes(key)) return key;

  return allowed.find((theme) => key.includes(theme) || theme.includes(key));
}

/** Extrai o primeiro objeto JSON da resposta (aceita ```json ... ```). */
function extractJsonObject(content: string): string | undefined {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return undefined;
  return content.slice(start, end + 1);
}

/** Valida e normaliza a resposta do modelo; `undefined` quando não dá para confiar. */
export function parseThemePlan(
  content: string | null | undefined,
  allowed: string[] = knownThemes(),
): ThemePlan | undefined {
  if (typeof content !== "string" || content.trim().length === 0) return undefined;

  const json = extractJsonObject(content);
  if (!json) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;

  const record = parsed as Record<string, unknown>;
  const theme = normalizeThemeCandidate(record.theme, allowed);
  if (!theme) return undefined;

  const reason = typeof record.reason === "string" ? record.reason.trim().slice(0, 200) : "";
  return reason ? { theme, reason } : { theme };
}

function systemPrompt(allowed: string[]): string {
  return [
    "Você é o anfitrião de uma Party: um jogo em grupo que monta pedidos do iFood para amigos",
    "em endereços diferentes a partir de UM tema comum.",
    "",
    "Leia as respostas de cada participante (restrições, orçamento, energia, formato e desejos)",
    "e escolha o tema que melhor representa o grupo. Considere TODOS: quando as respostas",
    "divergirem, procure o ponto em comum — quem pede algo leve puxa para saudável, maioria",
    "pedindo comfort food puxa para italiano, sobremesa em comum puxa para doce.",
    "Restrições valem como veto (ex.: vegetariano + churrasco não combina).",
    "",
    "Responda SOMENTE com um objeto JSON, sem texto fora dele:",
    '{"theme":"<tema>","reason":"<uma frase curta em português>"}',
    "",
    `"theme" deve ser exatamente um destes: ${allowed.join(", ")}.`,
    'Não invente tema, não traduza e não use sinônimos. "reason" explica a escolha em até 140 caracteres.',
  ].join("\n");
}

/** Só os sinais que importam para o tema, por participante (sem dados pessoais). */
export function themeAnswers(answers: Answers): Answers {
  const picked: Answers = {};
  for (const [key, value] of Object.entries(answers)) {
    if (THEME_ANSWER_KEYS.has(key)) picked[key] = value;
  }
  return picked;
}

/** Mensagens iniciais do planner: o catálogo fixo e as respostas anonimizadas do grupo. */
export function themePlannerMessages(
  answersByParticipant: Answers[],
  allowed: string[] = knownThemes(),
): ChatMessage[] {
  const participants = answersByParticipant.map((answers) => themeAnswers(answers));
  return [
    { role: "system", content: systemPrompt(allowed) },
    {
      role: "user",
      content: `Respostas do grupo (uma entrada por participante):\n${JSON.stringify(participants, null, 2)}`,
    },
  ];
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("Planner de tema excedeu o tempo limite")),
      timeoutMs,
    );
    timer.unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Cria o planner apoiado no cliente de LLM. Erros de rede, timeout ou tema fora do catálogo
 * viram exceção — o `PartyService` trata como "sem plano" e usa `deriveTheme`.
 */
export function createLlmThemePlanner(
  client: ChatClient,
  settings: LlmThemePlannerSettings = {},
): ThemePlanner {
  const timeoutMs = settings.timeoutMs ?? DEFAULT_THEME_PLANNER_TIMEOUT_MS;

  return async (answersByParticipant) => {
    const hasSignal = answersByParticipant.some(
      (answers) => Object.keys(themeAnswers(answers)).length > 0,
    );
    if (!hasSignal) {
      throw new Error("Sem sinais de tema nas respostas");
    }

    const messages = themePlannerMessages(answersByParticipant);
    const response = await withTimeout(client.complete(messages, []), timeoutMs);
    const plan = parseThemePlan(response.content);
    if (!plan) {
      throw new Error("Planner de tema não devolveu um tema do catálogo");
    }
    return plan;
  };
}
