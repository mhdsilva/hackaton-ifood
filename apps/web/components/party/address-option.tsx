import Image from "next/image";
import type { MockAddress } from "@/lib/mock-party";

export function AddressOption({ address, selected, onSelect }: {
  address: MockAddress;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <label className="relative flex min-h-[66px] cursor-pointer items-center gap-3 rounded-lg border border-input p-4 has-[:checked]:border-primary has-[:checked]:ring-[0.5px] has-[:checked]:ring-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-ring">
      <input type="radio" name="address" value={address.id} checked={selected} onChange={() => onSelect(address.id)} className="sr-only" />
      <Image src={selected ? "/figma/map-pin-selected.svg" : "/figma/map-pin.svg"} alt="" width={24} height={24} className="mr-1 shrink-0" />
      <span className="min-w-0 flex-1 space-y-[3px]">
        <span className={`block text-[15px] leading-[21px] ${selected ? "font-bold" : "font-medium"}`}>{address.label}</span>
        <span className="block text-xs leading-[normal] text-muted-foreground">{address.street}<br />{address.region}</span>
      </span>
      <span aria-hidden="true" className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-primary bg-primary" : "border-input"}`}>
        {selected && <Image src="/figma/check.svg" alt="" width={13} height={13} />}
      </span>
    </label>
  );
}
