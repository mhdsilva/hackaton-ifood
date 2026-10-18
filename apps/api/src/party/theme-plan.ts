/**
 * Contrato do "planner de tema": a Party pode delegar a escolha do tema a um agente (LLM),
 * olhando as respostas de **cada** participante, em vez de mesclar tudo e aplicar a tabela
 * determinística de `theme.ts`.
 *
 * O `PartyService` só conhece esta função; a implementação com LLM mora em
 * `agent/theme-planner.ts`. Sem planner — ou se ele falhar — `revealTheme` cai em
 * `deriveTheme`: a Party nunca fica sem tema.
 */

export type Answers = Record<string, unknown>;

export interface ThemePlan {
  /** Título livre escolhido pelo agente; também é o texto exibido na revelação. */
  theme: string;
  /** Termos de busca definidos pelo agente junto com o tema; usados obrigatoriamente no pedido. */
  queries: string[];
  /** Frase curta em pt-BR explicando a escolha; vira `party.themeReason`. */
  reason?: string;
}

/** Recebe as respostas de cada participante — sem nome, token ou endereço. */
export type ThemePlanner = (answersByParticipant: Answers[]) => Promise<ThemePlan>;
