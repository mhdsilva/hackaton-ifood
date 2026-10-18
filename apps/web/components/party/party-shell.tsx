"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuestionRouter } from "@/components/party/question-navigation";
import { cn } from "@/lib/utils";

type BrandTone = "primary" | "light" | "inverse";

export function PartyHeader({ backHref, brandTone = "primary" }: { backHref?: string; brandTone?: BrandTone }) {
  const router = useQuestionRouter();
  return (
    <header className={`shrink-0 ${backHref ? "border-b" : ""}`}>
      <div className="relative mx-auto flex h-[52px] w-full max-w-md items-center justify-center">
      {backHref ? <>
        <Link href={backHref} onNavigate={(event) => { event.preventDefault(); router.push(backHref); }} aria-label="Voltar" className="absolute left-1 flex size-11 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-ring">
          <Image src="/figma/back.svg" alt="" width={32} height={32} />
        </Link>
        <p className="font-heading text-base font-bold">IFOOD PARTY</p>
      </> : <div aria-label="iFood Party" className="flex items-center gap-[2.732px]">
        <Image src="/figma/logo.svg" alt="iFood" width={54.8293} height={30.439} className={brandTone === "inverse" ? "brightness-0 invert" : undefined} />
        <span className={`text-[21.219px] leading-[31.828px] font-black italic ${brandTone !== "primary" ? "text-foreground" : "text-primary"}`}>Party</span>
      </div>}
      </div>
    </header>
  );
}

export function PartyShell({ children, footer, backHref, tone = "default", brandTone = "primary", contentClassName, footerClassName }: {
  children: React.ReactNode;
  footer: React.ReactNode;
  backHref?: string;
  tone?: "default" | "celebration";
  brandTone?: BrandTone;
  contentClassName?: string;
  footerClassName?: string;
}) {
  return (
    <div className={cn("flex h-dvh w-full flex-col overflow-hidden pt-[env(safe-area-inset-top)]", tone === "celebration" && "bg-primary text-primary-foreground")}>
      <PartyHeader backHref={backHref} brandTone={brandTone} />
      <main id="main-content" className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-pt-5 scroll-pb-5">
        <div className={cn("party-content mx-auto flex w-full max-w-md flex-col gap-8 px-5 py-5", contentClassName)}>{children}</div>
      </main>
      <footer className={cn("z-10 shrink-0 border-t bg-background", tone === "celebration" && "border-transparent bg-primary")}>
        <div className={cn("mx-auto w-full max-w-md space-y-3 px-5 pt-5 pb-[max(20px,env(safe-area-inset-bottom))]", footerClassName)}>
          {footer}
        </div>
      </footer>
    </div>
  );
}
