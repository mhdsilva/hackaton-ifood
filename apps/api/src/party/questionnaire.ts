import type {
  QuestionnaireDefinition,
  QuestionnaireQuestion,
} from "@sidequest/contracts";

/**
 * Definição temporária do questionário, alinhada ao fluxo do Figma. O Júlio ainda
 * vai decidir as perguntas definitivas; este conteúdo existe para o frontend
 * renderizar o formulário dinamicamente sem fixar campos no cliente de API.
 *
 * Pergunta 1 é o endereço (opções vêm do iFood, não daqui); as demais são comuns.
 */
export const CURRENT_QUESTIONNAIRE: QuestionnaireDefinition = {
  version: "v1",
  title: "Antes de montar a party",
  introduction:
    "Definição provisória. As perguntas finais serão definidas pelo produto; a tela lê tudo daqui.",
  questions: [
    {
      id: "address",
      type: "address",
      label: "Onde você vai curtir a party hoje?",
      required: true,
      helpText:
        "Usaremos a região para encontrar opções da mesma temática para todos vocês.",
    },
    {
      id: "restrictions",
      type: "multi_choice",
      label: "Antes, você possui alguma restrição?",
      required: false,
      helpText: "Selecione as restrições que se apliquem a você.",
      options: [
        { id: "vegetariano", label: "Vegetariano" },
        { id: "sem-lactose", label: "Sem lactose" },
        { id: "sem-gluten", label: "Sem glúten" },
        { id: "sem-acucar", label: "Sem açúcar" },
        { id: "outro", label: "Outro" },
      ],
    },
  ],
};

export function getQuestionnaire(
  version?: string,
): QuestionnaireDefinition | undefined {
  if (!version || version === CURRENT_QUESTIONNAIRE.version) {
    return structuredClone(CURRENT_QUESTIONNAIRE);
  }
  return undefined;
}

export interface AnswerIssue {
  questionId: string;
  reason: string;
}

/**
 * Texto livre do "Outro" e valor digitado do "Outro valor" ficam em chaves
 * companheiras, para manter `answers` como mapa plano:
 *   answers[`${questionId}__other`] -> string
 *   answers[`${questionId}__value`] -> number
 */
export const OTHER_ANSWER_SUFFIX = "__other";
export const VALUE_ANSWER_SUFFIX = "__value";

export function otherAnswerKey(questionId: string): string {
  return `${questionId}${OTHER_ANSWER_SUFFIX}`;
}

export function valueAnswerKey(questionId: string): string {
  return `${questionId}${VALUE_ANSWER_SUFFIX}`;
}

const DEFAULT_OTHER_OPTION_ID = "outro";

function isBlank(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0)
  );
}

function otherOptionId(question: QuestionnaireQuestion): string {
  return question.otherOptionId ?? DEFAULT_OTHER_OPTION_ID;
}

function selectedIncludes(value: unknown, optionId: string): boolean {
  return Array.isArray(value) ? value.includes(optionId) : value === optionId;
}

export interface ValidateAnswersOptions {
  /** `true` (padrão) cobra as obrigatórias; `false` valida só o que veio (rascunho). */
  requireComplete?: boolean;
}

function checkOtherText(
  question: QuestionnaireQuestion,
  value: unknown,
  answers: Record<string, unknown>,
  issues: AnswerIssue[],
): void {
  if (!question.allowOther) return;
  if (!selectedIncludes(value, otherOptionId(question))) return;
  const text = answers[otherAnswerKey(question.id)];
  if (typeof text !== "string" || text.trim() === "") {
    issues.push({ questionId: question.id, reason: "other_required" });
  }
}

function checkCustomValue(
  question: QuestionnaireQuestion,
  value: unknown,
  answers: Record<string, unknown>,
  issues: AnswerIssue[],
): void {
  const custom = question.customInput;
  if (!custom) return;
  if (value !== otherOptionId(question)) return;
  const raw = answers[valueAnswerKey(question.id)];
  if (
    typeof raw !== "number" ||
    Number.isNaN(raw) ||
    raw < custom.min ||
    raw > custom.max
  ) {
    issues.push({ questionId: question.id, reason: "custom_value_required" });
  }
}

/**
 * Valida as respostas contra a definição da versão. Ignora chaves que não
 * pertencem à definição; cobra as obrigatórias (quando `requireComplete`) e
 * checa tipo, teto de seleções, "Outro" com texto e "Outro valor" digitado.
 */
export function validateAnswers(
  definition: QuestionnaireDefinition,
  answers: Record<string, unknown>,
  options: ValidateAnswersOptions = {},
): AnswerIssue[] {
  const requireComplete = options.requireComplete ?? true;
  const issues: AnswerIssue[] = [];

  for (const question of definition.questions) {
    const value = answers[question.id];
    if (isBlank(value)) {
      if (requireComplete && question.required) {
        issues.push({ questionId: question.id, reason: "required" });
      }
      continue;
    }

    switch (question.type) {
      case "text":
        if (typeof value !== "string" || value.trim() === "") {
          issues.push({ questionId: question.id, reason: "invalid_text" });
        }
        break;
      case "address":
        if (typeof value !== "string" || value.trim() === "") {
          issues.push({ questionId: question.id, reason: "invalid_address" });
        }
        break;
      case "single_choice":
        if (
          typeof value !== "string" ||
          !question.options?.some((option) => option.id === value)
        ) {
          issues.push({ questionId: question.id, reason: "invalid_option" });
          break;
        }
        checkOtherText(question, value, answers, issues);
        checkCustomValue(question, value, answers, issues);
        break;
      case "multi_choice":
        if (
          !Array.isArray(value) ||
          !value.every(
            (entry) =>
              typeof entry === "string" &&
              question.options?.some((option) => option.id === entry),
          )
        ) {
          issues.push({ questionId: question.id, reason: "invalid_option" });
          break;
        }
        if (
          question.maxSelections !== undefined &&
          value.length > question.maxSelections
        ) {
          issues.push({ questionId: question.id, reason: "too_many_selections" });
        }
        checkOtherText(question, value, answers, issues);
        break;
      case "scale":
        if (
          typeof value !== "number" ||
          Number.isNaN(value) ||
          (question.min !== undefined && value < question.min) ||
          (question.max !== undefined && value > question.max)
        ) {
          issues.push({ questionId: question.id, reason: "out_of_range" });
        }
        break;
    }
  }

  return issues;
}

/** Quantas perguntas da definição têm resposta (progresso "Etapa X de Y"). */
export function countAnswered(
  definition: QuestionnaireDefinition,
  answers: Record<string, unknown>,
): number {
  return definition.questions.filter((question) => !isBlank(answers[question.id]))
    .length;
}
