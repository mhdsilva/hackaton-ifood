import { SelectionCard } from "@/components/ui/selection-card";

export function QuestionChoices<T extends string>({ name, legend, options, selected, onSelect, multiple = false, maxSelections = 2 }: {
  name: string;
  legend: string;
  options: readonly { id: T; label: string }[];
  selected: readonly T[];
  onSelect: (id: T) => void;
  multiple?: boolean;
  maxSelections?: number;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-4 text-base leading-6 font-bold">{legend}</legend>
      {multiple && <p id={`${name}-limit`} role="status" className="sr-only">Escolha pelo menos uma opção e no máximo {maxSelections}. {selected.length} selecionadas.</p>}
      <div className="space-y-[10px]">
        {options.map((option) => {
          const checked = selected.includes(option.id);
          return <SelectionCard key={option.id} type={multiple ? "checkbox" : "radio"} name={name} value={option.id} checked={checked} onSelect={() => onSelect(option.id)} disabled={multiple && selected.length >= maxSelections && !checked} describedBy={multiple ? `${name}-limit` : undefined}>
            <span className={`min-w-0 flex-1 text-[15px] leading-[21px] ${checked ? "font-bold" : "font-medium text-muted-foreground"}`}>{option.label}</span>
          </SelectionCard>;
        })}
      </div>
    </fieldset>
  );
}
