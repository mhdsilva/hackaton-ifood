import Image from "next/image";
import { cn } from "@/lib/utils";

export function RadioCard({ name, value, checked, onSelect, children, className }: {
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("relative flex min-h-[66px] cursor-pointer items-center gap-3 rounded-lg border border-input p-[14px] has-[:checked]:border-primary has-[:checked]:ring-[0.5px] has-[:checked]:ring-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-ring", className)}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onSelect} className="sr-only" />
      {children}
      <span aria-hidden="true" className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${checked ? "border-primary bg-primary" : "border-input"}`}>
        {checked && <Image src="/figma/check.svg" alt="" width={13} height={13} />}
      </span>
    </label>
  );
}
