import Image from "next/image";
import Link from "next/link";

export function PartyHeader({ backHref }: { backHref?: string }) {
  return (
    <header className="relative flex h-[52px] shrink-0 items-center justify-center overflow-hidden">
      {backHref ? <>
        <Link href={backHref} aria-label="Voltar" className="absolute left-1 flex size-11 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-ring">
          <Image src="/figma/back.svg" alt="" width={32} height={32} />
        </Link>
        <p className="font-heading text-base font-bold">IFOOD PARTY</p>
        <Image src="/figma/header-line.svg" alt="" width={390} height={1} className="absolute bottom-0 left-1/2 max-w-none -translate-x-1/2" />
      </> : <div aria-label="iFood Party" className="flex items-center gap-[2.732px]">
        <Image src="/figma/logo.svg" alt="iFood" width={54.8293} height={30.439} />
        <span className="text-[21.219px] leading-[31.828px] font-black text-primary italic">Party</span>
      </div>}
    </header>
  );
}

export function PartyShell({ children, footer, backHref }: {
  children: React.ReactNode;
  footer: React.ReactNode;
  backHref?: string;
}) {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col pt-[env(safe-area-inset-top)]">
      <PartyHeader backHref={backHref} />
      <main id="main-content" className="flex flex-1 flex-col gap-8 px-5 pt-5 pb-3">{children}</main>
      <footer className="space-y-3 px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        {footer}
        <p className="text-center text-[11px] text-muted-foreground">Prévia com dados simulados · <Link href="/dev/components" className="rounded-sm underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring">Componentes</Link></p>
      </footer>
    </div>
  );
}
