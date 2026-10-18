"use client";

import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const amountFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// O estado guarda reais em formato decimal; a máscara mostra milhares e centavos.
export function CurrencyInput({ value, onValueChange, className, ...props }:
  Omit<ComponentProps<"input">, "value" | "onChange" | "type" | "inputMode"> & {
    value: string;
    onValueChange: (value: string) => void;
  }) {
  return (
    <div className={cn("flex min-h-11 items-center gap-1 rounded-lg border border-input bg-background px-3 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50", className)}>
      <span className="shrink-0 text-sm text-muted-foreground" aria-hidden="true">Até R$</span>
      <Input
        {...props}
        type="text"
        inputMode="numeric"
        placeholder="0,00"
        className="min-h-0 rounded-none border-0 bg-transparent px-0 text-sm tabular-nums focus-visible:ring-0"
        value={value ? amountFormatter.format(Number(value.replace(",", "."))) : ""}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "");
          const cents = Number(digits);
          if (Number.isSafeInteger(cents)) onValueChange(digits ? (cents / 100).toFixed(2) : "");
        }}
      />
    </div>
  );
}
