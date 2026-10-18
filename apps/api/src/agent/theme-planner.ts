/**
 * Planner de tema: o agente escolhe o tema da Party a partir das respostas de **todos** os
 * participantes, em vez da tabela determinística de `party/theme.ts`.
 *
 * O tema é livre: o modelo inventa um título curto e também escolhe os termos de busca que o
 * agente de opções usará no iFood. Não existe catálogo de temas permitidos. Se o modelo falhar
 * ou devolver uma resposta incompleta, o `PartyService` cai no `deriveTheme` determinístico.
 */

import type { ChatClient, ChatMessage } from "../llm/client.js";
import { groupConsensus } from "../party/consensus.js";
import type { Answers, ThemePlan, ThemePlanner } from "../party/theme-plan.js";

export interface LlmThemePlannerSettings {
  /** Teto de espera do modelo; estourou, o reveal cai no determinístico. */
  timeoutMs?: number;
  /** Data de referência para o horário no prompt; injetável para teste. */
  now?: () => Date;
}

export const DEFAULT_THEME_PLANNER_TIMEOUT_MS = 10_000;

const MAX_THEME_CHARS = 60;
const MAX_QUERY_CHARS = 40;
const MAX_QUERIES = 4;
const MAX_REASON_CHARS = 140;


/** Extrai o primeiro objeto JSON da resposta (aceita ```json ... ```). */
function extractJsonObject(content: string): string | undefined {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return undefined;
  return content.slice(start, end + 1);
}

/** Texto de uma linha, sem espaços repetidos; `undefined` quando vazio ou de outro tipo. */
function cleanText(value: unknown, maxChars: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return undefined;
  return cleaned.slice(0, maxChars).trim();
}

/** Termos de busca válidos, sem duplicatas e com um teto pequeno. */
function parseQueries(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const queries: string[] = [];

  for (const value of raw) {
    const query = cleanText(value, MAX_QUERY_CHARS);
    if (!query) continue;
    const key = query.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    queries.push(query);
    if (queries.length === MAX_QUERIES) break;
  }

  return queries;
}

/** Valida e normaliza a resposta do modelo; `undefined` quando não dá para confiar. */
export function parseThemePlan(content: string | null | undefined): ThemePlan | undefined {
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
  const theme = cleanText(record.theme, MAX_THEME_CHARS);
  if (!theme) return undefined;

  // Sem buscas o agente de opções não teria como respeitar o tema; é falha do plano.
  const queries = parseQueries(record.queries);
  if (queries.length === 0) return undefined;

  const reason = cleanText(record.reason, MAX_REASON_CHARS);
  return reason ? { theme, queries, reason } : { theme, queries };
}

/** Data e hora no fuso da Party, para o título combinar com o momento do dia. */
function timeContext(now: Date): string {
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
  return `Horário de referência: ${formatted} (America/Sao_Paulo).`;
}

function systemPrompt(): string {
  return [
    "Você é o anfitrião de uma Party: um jogo em grupo que monta pedidos do iFood para amigos",
    "em endereços diferentes a partir de UM tema comum.",
    "",
    "Você recebe apenas o CONSENSO do grupo: os sinais (energia, formato, desejos) que TODOS os",
    "participantes compartilham. Invente o tema que melhor representa esse ponto em comum.",
    "",
    "O tema é o consenso do grupo. Restrição alimentar ou preferência de uma pessoa só (ou de",
    "parte do grupo) nunca aparece no título, na justificativa nem nos termos de busca: isso vale",
    "apenas para o pedido dessa pessoa e já é tratado em outra etapa. Não invente restrições.",
    "",
    "O tema é LIVRE. Não existe lista de temas permitidos e você não deve escolher uma",
    "categoria pronta. Crie um título curto e natural em português, com até 5 palavras e no",
    "máximo 60 caracteres. Ele é o texto que o grupo vê na revelação.",
    "",
    "O horário importa: o título deve combinar com o momento (almoço, jantar, noite ou",
    "madrugada) ou ficar neutro quando não houver pista clara. Nunca diga 'noite' de manhã ou",
    "à tarde.",
    "",
    "Escolha também de 2 a 4 termos curtos de busca de comida que um buscador de restaurantes",
    "do iFood entenda. Eles são obrigatórios e serão usados para procurar o pedido; não use o",
    "título inteiro como termo nem fuja do assunto do grupo.",
    "",
    "Responda SOMENTE com um objeto JSON, sem texto fora dele:",
    '{"theme":"<título livre>","queries":["<termo>","<termo>"],"reason":"<uma frase curta>"}',
    "",
    '"theme" até 60 caracteres; "queries" de 2 a 4 termos com até 40 caracteres cada;',
    '"reason" explica a escolha em até 140 caracteres.',
  ].join("\n");
}

/** Mensagens iniciais do planner: horário, consenso do grupo e nenhum catálogo fixo. */
export function themePlannerMessages(
  answersByParticipant: Answers[],
  now: Date = new Date(),
): ChatMessage[] {
  const consensus = groupConsensus(answersByParticipant);
  return [
    { role: "system", content: systemPrompt() },
    {
      role: "user",
      content: [
        timeContext(now),
        "",
        `Participantes: ${answersByParticipant.length}.`,
        `Consenso do grupo (só o que todos compartilham):\n${JSON.stringify(consensus, null, 2)}`,
      ].join("\n"),
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
 * Cria o planner apoiado no cliente de LLM. Erros de rede, timeout ou plano incompleto viram
 * exceção — o `PartyService` trata como "sem plano" e usa `deriveTheme`.
 */
export function createLlmThemePlanner(
  client: ChatClient,
  settings: LlmThemePlannerSettings = {},
): ThemePlanner {
  const timeoutMs = settings.timeoutMs ?? DEFAULT_THEME_PLANNER_TIMEOUT_MS;

  return async (answersByParticipant) => {
    if (Object.keys(groupConsensus(answersByParticipant)).length === 0) {
      throw new Error("Sem consenso de tema entre os participantes");
    }

    const messages = themePlannerMessages(
      answersByParticipant,
      settings.now?.() ?? new Date(),
    );
    const response = await withTimeout(client.complete(messages, []), timeoutMs);
    const plan = parseThemePlan(response.content);
    if (!plan) {
      throw new Error("Planner de tema não devolveu um tema e buscas válidos");
    }
    return plan;
  };
}
