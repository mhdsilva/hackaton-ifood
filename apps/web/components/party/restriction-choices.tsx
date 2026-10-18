import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMockRestrictionOptions, type RestrictionId } from "@/lib/mock-questionnaire";

export function RestrictionChoices({ selected, onToggle, other, onOtherChange, inputId }: {
  selected: RestrictionId[];
  onToggle: (id: RestrictionId) => void;
  other: string;
  onOtherChange: (value: string) => void;
  inputId: string;
}) {
  return (
    <fieldset className="min-w-0 space-y-4">
      <legend className="mb-4 text-base leading-6 font-bold">Selecione restrições que se apliquem</legend>
      <div className="flex flex-wrap gap-2">
        {getMockRestrictionOptions().map((option) => <Button key={option.id} type="button" variant="chip" size="chip" aria-pressed={selected.includes(option.id)} onClick={() => onToggle(option.id)}>{option.label}</Button>)}
      </div>
      {selected.includes("other") && <div className="space-y-2">
        <label htmlFor={inputId} className="text-sm font-medium">Qual outra restrição?</label>
        <Input id={inputId} value={other} onChange={(event) => onOtherChange(event.target.value)} placeholder="Descreva sua restrição" required maxLength={500} />
      </div>}
    </fieldset>
  );
}
