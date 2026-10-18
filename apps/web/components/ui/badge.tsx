import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Badge({ variant = "muted", className, ...props }: ComponentProps<"span"> & { variant?: "muted" | "soft" | "solid" }) {
  return <span className={cn("shrink-0 rounded-full px-3 py-1 text-[11px] leading-6 font-medium", {
    muted: "bg-secondary text-muted-foreground",
    soft: "bg-host-badge text-primary",
    solid: "bg-primary text-primary-foreground",
  }[variant], className)} {...props} />;
}
