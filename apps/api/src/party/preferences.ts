/**
 * Preferências individuais do participante (desejos, exclusões e textos livres), lidas das
 * respostas salvas dele. Vão só para o pedido dele; o tema da Party usa apenas o consenso
 * (`consensus.ts`).
 */

import { otherAnswerKey, type PersonalPreferences } from "@sidequest/contracts";

import { getQuestionnaire } from "./questionnaire.js";

const IGNORED_OPTION_IDS = new Set(["surpreenda", "outro"]);

function selectedLabels(
  answers: Record<string, unknown>,
  questionId: string,
  labelOf: Map<string, string>,
): string[] {
  const value = answers[questionId];
  if (!Array.isArray(value)) return [];
  return value.flatMap((id) => {
    if (typeof id !== "string" || IGNORED_OPTION_IDS.has(id)) return [];
    return [labelOf.get(id) ?? id];
  });
}

function freeText(answers: Record<string, unknown>, questionId: string): string[] {
  const value = answers[otherAnswerKey(questionId)];
  return typeof value === "string" && value.trim() ? [value.trim()] : [];
}

export function personalPreferences(
  answers: Record<string, unknown> | undefined,
  questionnaireVersion?: string,
): PersonalPreferences | undefined {
  if (!answers) return undefined;
  const definition = getQuestionnaire(questionnaireVersion);
  const labels = (questionId: string) =>
    new Map(
      (definition?.questions.find((question) => question.id === questionId)?.options ?? []).map(
        (option) => [option.id, option.label] as const,
      ),
    );

  const cravings = selectedLabels(answers, "cravings", labels("cravings"));
  const avoid = selectedLabels(answers, "exclusions", labels("exclusions"));
  const notes = [...freeText(answers, "restrictions"), ...freeText(answers, "exclusions")];
  if (cravings.length === 0 && avoid.length === 0 && notes.length === 0) return undefined;
  return {
    ...(cravings.length > 0 ? { cravings } : {}),
    ...(avoid.length > 0 ? { avoid } : {}),
    ...(notes.length > 0 ? { notes } : {}),
  };
}
