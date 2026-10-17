import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Componentes | iFood Party" };

export default function ComponentsPage() {
  return (
    <main className="mx-auto min-h-svh max-w-4xl space-y-8 px-6 py-12 sm:px-10">
      <header className="space-y-4">
        <Link href="/" className="rounded-sm text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Voltar ao início</Link>
        <p className="text-sm font-medium text-muted-foreground">iFood Party · Desenvolvimento</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Vitrine de componentes</h1>
        <p className="max-w-2xl leading-relaxed text-muted-foreground">
          Referência dos componentes compartilhados disponíveis. A apresentação é provisória e será adaptada ao design do Figma. Os exemplos são demonstrativos.
        </p>
      </header>

      <section aria-labelledby="variants-title" className="rounded-xl border bg-card p-6 sm:p-8">
        <h2 id="variants-title" className="text-xl font-semibold">Button · Variantes</h2>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button type="button">Principal</Button>
          <Button type="button" variant="secondary">Secundário</Button>
          <Button type="button" variant="outline">Contorno</Button>
          <Button type="button" variant="ghost">Discreto</Button>
          <Button type="button" variant="link">Link</Button>
          <Button type="button" variant="destructive">Destrutivo</Button>
        </div>
      </section>

      <section aria-labelledby="sizes-title" className="rounded-xl border bg-card p-6 sm:p-8">
        <h2 id="sizes-title" className="text-xl font-semibold">Tamanhos</h2>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button type="button" size="xs">Extra pequeno</Button>
          <Button type="button" size="sm">Pequeno</Button>
          <Button type="button">Padrão</Button>
          <Button type="button" size="lg">Grande</Button>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">Botões somente com ícone têm um nome acessível.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {(["icon-xs", "icon-sm", "icon", "icon-lg"] as const).map((size) => (
            <Button key={size} type="button" size={size} variant="outline" aria-label={`Adicionar (${size})`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </Button>
          ))}
        </div>
      </section>

      <section aria-labelledby="states-title" className="rounded-xl border bg-card p-6 sm:p-8">
        <h2 id="states-title" className="text-xl font-semibold">Estados e teclado</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Use Tab e Shift + Tab para percorrer os exemplos e conferir o foco visível. Passe o cursor sobre os botões para conferir o estado de hover. Botões desabilitados ficam fora da sequência de foco.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button type="button">Disponível</Button>
          <Button type="button" disabled>Indisponível</Button>
          <Button type="button" variant="outline" disabled>Contorno indisponível</Button>
        </div>
      </section>
    </main>
  );
}
