"use client";

/**
 * Formulário mínimo que renderiza o questionário vindo de `GET /questionnaire`.
 * Nada de ids fixos: o que a API mandar é o que aparece. Só para a pasta de
 * teste — o visual definitivo é do Otávio.
 */
import { useState } from "react";
import type { QuestionnaireDefinition, QuestionnaireQuestion } from "@sidequest/contracts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const otherOptionId = (question: QuestionnaireQuestion) => question.otherOptionId ?? "outro";
const picks = (value: unknown, optionId: string) => Array.isArray(value) && value.includes(optionId);

export function QuestionnaireForm({
  definition,
  initial,
  busy,
  onSubmit,
}: {
  definition: QuestionnaireDefinition;
  initial?: Record<string, unknown>;
  busy?: boolean;
  onSubmit: (answers: Record<string, unknown>) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => ({ ...(initial ?? {}) }));

  function set(id: string, value: unknown) {
    setAnswers((current) => ({ ...current, [id]: value }));
  }

  function toggle(id: string, optionId: string, maxSelections?: number) {
    setAnswers((current) => {
      const list = Array.isArray(current[id]) ? (current[id] as string[]) : [];
      const next = list.includes(optionId)
        ? list.filter((entry) => entry !== optionId)
        : maxSelections !== undefined && list.length >= maxSelections
          ? list
          : [...list, optionId];
      return { ...current, [id]: next };
    });
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(answers);
      }}
    >
      <p className="text-xs text-muted-foreground">
        questionário <strong>{definition.version}</strong> · {definition.questions.length} perguntas
      </p>

      {definition.questions.map((question) => {
        const value = answers[question.id];
        const other = otherOptionId(question);
        return (
          <fieldset key={question.id} className="space-y-2 rounded-lg border p-3">
            <legend className="px-1 text-sm font-bold">
              {question.label}
              {question.required && <span className="text-primary"> *</span>}
            </legend>
            {question.helpText && (
              <p className="text-xs text-muted-foreground">{question.helpText}</p>
            )}

            {(question.type === "text" || question.type === "address") && (
              <input
                type="text"
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder={question.type === "address" ? "addressId (ex.: casa)" : ""}
                value={typeof value === "string" ? value : ""}
                onChange={(event) => set(question.id, event.target.value)}
              />
            )}

            {question.type === "scale" && (
              <input
                type="number"
                className="w-28 rounded-md border px-3 py-2 text-sm"
                min={question.min}
                max={question.max}
                value={typeof value === "number" ? value : ""}
                onChange={(event) => set(question.id, Number(event.target.value))}
              />
            )}

            {question.type === "single_choice" && (
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={typeof value === "string" ? value : ""}
                onChange={(event) => set(question.id, event.target.value || undefined)}
              >
                <option value="">— escolha —</option>
                {(question.options ?? []).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                    {option.value !== undefined ? ` (R$ ${option.value})` : ""}
                  </option>
                ))}
              </select>
            )}

            {question.type === "multi_choice" && (
              <div className="space-y-1">
                {(question.options ?? []).map((option) => {
                  const list = Array.isArray(value) ? (value as string[]) : [];
                  const checked = list.includes(option.id);
                  const atLimit =
                    question.maxSelections !== undefined &&
                    list.length >= question.maxSelections &&
                    !checked;
                  return (
                    <label
                      key={option.id}
                      className={cn(
                        "flex items-center gap-2 text-sm",
                        atLimit && "opacity-40",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={atLimit}
                        onChange={() => toggle(question.id, option.id, question.maxSelections)}
                      />
                      {option.label}
                    </label>
                  );
                })}
                {question.maxSelections !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    até {question.maxSelections}
                  </p>
                )}
              </div>
            )}

            {/* "Outro" (texto livre) */}
            {question.allowOther && picks(value, other) && (
              <input
                type="text"
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder={question.otherInput?.placeholder ?? "Outro"}
                value={typeof answers[`${question.id}__other`] === "string" ? (answers[`${question.id}__other`] as string) : ""}
                onChange={(event) => set(question.id + "__other", event.target.value)}
              />
            )}

            {/* "Outro valor" (número) */}
            {question.customInput && value === other && (
              <input
                type="number"
                className="w-32 rounded-md border px-3 py-2 text-sm"
                placeholder={question.customInput.placeholder}
                min={question.customInput.min}
                max={question.customInput.max}
                value={typeof answers[`${question.id}__value`] === "number" ? (answers[`${question.id}__value`] as number) : ""}
                onChange={(event) => set(question.id + "__value", Number(event.target.value))}
              />
            )}
          </fieldset>
        );
      })}

      <Button type="submit" size="party" className="w-full" disabled={busy}>
        {busy ? "Enviando…" : "Enviar respostas (completed: true)"}
      </Button>
      <pre className="max-h-40 overflow-auto rounded-md bg-secondary p-2 text-[11px]">
        {JSON.stringify(answers, null, 2)}
      </pre>
    </form>
  );
}
