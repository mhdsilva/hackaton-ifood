import Image from "next/image";
import { CurrencyInput } from "@/components/ui/currency-input";
import { RadioCard } from "@/components/ui/radio-card";
import { getMockBudgetOptions, type BudgetOptionId } from "@/lib/mock-questionnaire";

export function BudgetChoices({ selected, onSelect, customValue, onCustomChange, inputId }: {
  selected: BudgetOptionId | null;
  onSelect: (value: BudgetOptionId) => void;
  customValue: string;
  onCustomChange: (value: string) => void;
  inputId: string;
}) {
  return (
    <div className="space-y-4">
      <fieldset className="min-w-0">
        <legend className="mb-4 text-base leading-6 font-bold">Selecione o orçamento desejado</legend>
        <div className="space-y-3">
          {getMockBudgetOptions().map((option) => <RadioCard key={option.id} name={inputId} value={option.id} checked={selected === option.id} onSelect={() => onSelect(option.id)}>
            <span className={`min-w-0 flex-1 text-[15px] leading-[21px] ${selected === option.id ? "font-bold" : "font-medium text-muted-foreground"}`}>{option.label}</span>
          </RadioCard>)}
        </div>
        {selected === "other" && <div className="mt-4 space-y-2">
          <label htmlFor={inputId} className="text-sm font-medium">Selecione seu orçamento desejado</label>
          <CurrencyInput id={inputId} value={customValue} onValueChange={onCustomChange} aria-label="Orçamento máximo em reais" required />
        </div>}
      </fieldset>
      <aside className="flex items-start gap-[10px] rounded-lg bg-secondary p-3">
        <Image src="/figma/wallet.svg" alt="" width={18} height={18} className="shrink-0" />
        <p className="min-w-0 flex-1 text-xs leading-[18px] text-subtle">Vamos buscar opções que caibam no seu bolso.<br />Você revisa o total antes de realizar o pedido.</p>
      </aside>
    </div>
  );
}
