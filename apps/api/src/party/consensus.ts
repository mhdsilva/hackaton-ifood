/**
 * Consenso do grupo para o tema. O tema vale para todos os participantes, então só o que
 * **todos** compartilham pode influenciá-lo; restrições, exclusões, orçamento e textos livres
 * são individuais e entram apenas no pedido da própria pessoa.
 */

import type { Answers } from "./theme-plan.js";

/**
 * Respostas escalares que podem virar tema quando todos escolhem o mesmo valor. `theme`
 * explícito (override de teste/demo) também só vale quando todos concordam.
 */
const SCALAR_KEYS = ["theme", "energy", "order-style"] as const;
/** Respostas em lista cujos itens em comum entre todos podem virar tema. */
const LIST_KEYS = ["cravings"] as const;
/** "Tanto faz" não decide nada, nem em consenso. */
const NEUTRAL_VALUES = new Set(["surpreenda"]);

export function groupConsensus(answersByParticipant: Answers[]): Answers {
  if (answersByParticipant.length === 0) return {};
  const consensus: Answers = {};

  for (const key of SCALAR_KEYS) {
    const values = answersByParticipant.map((answers) => answers[key]);
    const first = values[0];
    if (
      typeof first === "string" &&
      first.trim() !== "" &&
      !NEUTRAL_VALUES.has(first) &&
      values.every((value) => value === first)
    ) {
      consensus[key] = first;
    }
  }

  for (const key of LIST_KEYS) {
    const lists = answersByParticipant.map((answers) => answers[key]);
    if (!lists.every(Array.isArray)) continue;
    const [head, ...rest] = lists as unknown[][];
    const shared = head.filter(
      (item): item is string =>
        typeof item === "string" &&
        !NEUTRAL_VALUES.has(item) &&
        rest.every((list) => list.includes(item)),
    );
    if (shared.length > 0) consensus[key] = [...new Set(shared)];
  }

  return consensus;
}
