import Image from "next/image";
import Link from "next/link";

export function PartyHeader({ backHref }: { backHref?: string }) {
  return (
    <header className={`shrink-0 ${backHref ? "border-b" : ""}`}>
      <div className="relative mx-auto flex h-[52px] w-full max-w-md items-center justify-center">
      {backHref ? <>
        <Link href={backHref} aria-label="Voltar" className="absolute left-1 flex size-11 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-ring">
          <Image src="/figma/back.svg" alt="" width={32} height={32} />
        </Link>
        <p className="font-heading text-base font-bold">IFOOD PARTY</p>
      </> : <div aria-label="iFood Party" className="flex items-center gap-[2.732px]">
        <Image src="/figma/logo.svg" alt="iFood" width={54.8293} height={30.439} />
        <span className="text-[21.219px] leading-[31.828px] font-black text-primary italic">Party</span>
      </div>}
      </div>
    </header>
  );
}

export function PartyShell({ children, footer, backHref }: {
  children: React.ReactNode;
  footer: React.ReactNode;
  backHref?: string;
}) {
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden pt-[env(safe-area-inset-top)]">
      <PartyHeader backHref={backHref} />
      <main id="main-content" className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-pt-5 scroll-pb-5">
        <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-5 py-5">{children}</div>
      </main>
      <footer className="z-10 shrink-0 border-t bg-background">
        <div className="mx-auto w-full max-w-md space-y-3 px-5 pt-5 pb-[max(20px,env(safe-area-inset-bottom))]">
          {footer}
        </div>
      </footer>
    </div>
  );
}
