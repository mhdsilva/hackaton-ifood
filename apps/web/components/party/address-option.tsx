import Image from "next/image";
import type { MockAddress } from "@/lib/mock-party";
import { SelectionCard } from "@/components/ui/selection-card";

export function AddressOption({ address, selected, onSelect }: {
  address: MockAddress;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <SelectionCard name="address" value={address.id} checked={selected} onSelect={() => onSelect(address.id)} className="p-4">
      <Image src={selected ? "/figma/map-pin-selected.svg" : "/figma/map-pin.svg"} alt="" width={24} height={24} className="mr-1 shrink-0" />
      <span className="min-w-0 flex-1 space-y-[3px]">
        <span className={`block text-[15px] leading-[21px] ${selected ? "font-bold" : "font-medium"}`}>{address.label}</span>
        <span className="block text-xs leading-[normal] text-muted-foreground">{address.street}<br />{address.region}</span>
      </span>
    </SelectionCard>
  );
}
