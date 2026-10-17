import type { QuestionnaireDefinition } from "@sidequest/contracts";

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

function isBlank(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0)
  );
}

/**
 * Valida as respostas contra a definição da versão. Ignora chaves que não
 * pertencem à definição; cobra os obrigatórios e checa o tipo de cada resposta.
 */
export function validateAnswers(
  definition: QuestionnaireDefinition,
  answers: Record<string, unknown>,
): AnswerIssue[] {
  const issues: AnswerIssue[] = [];

  for (const question of definition.questions) {
    const value = answers[question.id];
    if (isBlank(value)) {
      if (question.required) issues.push({ questionId: question.id, reason: "required" });
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
        }
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
        }
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
