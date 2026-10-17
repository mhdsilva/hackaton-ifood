import type { QuestionnaireDefinition } from "@sidequest/contracts";

/**
 * Definição temporária do questionário. O Júlio ainda vai decidir as perguntas
 * definitivas; este conteúdo existe para o frontend renderizar o formulário
 * dinamicamente sem fixar campos no cliente de API.
 */
export const CURRENT_QUESTIONNAIRE: QuestionnaireDefinition = {
  version: "v1",
  title: "Nos conte o essencial",
  introduction:
    "Definição provisória. As perguntas finais serão definidas pelo produto; a tela lê tudo daqui.",
  questions: [
    {
      id: "budget",
      type: "scale",
      label: "Quanto você pretende gastar?",
      required: true,
      min: 1,
      max: 5,
    },
    {
      id: "preference",
      type: "text",
      label: "O que está com vontade de comer?",
      required: true,
      helpText: "Ex.: massa, japonês, algo picante.",
    },
    {
      id: "restrictions",
      type: "multi_choice",
      label: "Alguma restrição alimentar?",
      required: false,
      options: [
        { id: "vegetariano", label: "Vegetariano" },
        { id: "sem-lactose", label: "Sem lactose" },
        { id: "sem-gluten", label: "Sem glúten" },
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
