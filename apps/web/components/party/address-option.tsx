import Image from "next/image";
import { addressDetailLines, type PartyAddress } from "@/lib/addresses";
import { SelectionCard } from "@/components/ui/selection-card";

export function AddressOption({ address, selected, onSelect }: {
  address: PartyAddress;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const lines = addressDetailLines(address);
  return (
    <SelectionCard name="address" value={address.id} checked={selected} onSelect={() => onSelect(address.id)} className="p-4">
      <Image src={selected ? "/figma/map-pin-selected.svg" : "/figma/map-pin.svg"} alt="" width={24} height={24} className="mr-1 shrink-0" />
      <span className="min-w-0 flex-1 space-y-[3px] break-words">
        <span className={`block text-[15px] leading-[21px] ${selected ? "font-bold" : "font-medium"}`}>
          {address.label}
          {address.lastUsed && <span className="ml-2 text-xs font-normal text-muted-foreground">último usado</span>}
        </span>
        {lines.length > 0 && (
          <span className="block text-xs leading-[normal] text-muted-foreground">
            {lines.map((line, index) => <span key={index} className="block">{line}</span>)}
          </span>
        )}
      </span>
    </SelectionCard>
  );
}
