import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col justify-center gap-10 px-6 py-12 sm:px-10">
      <header className="space-y-4">
        <p className="text-sm font-medium text-muted-foreground">iFood Party</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Nossa próxima experiência começa aqui.</h1>
        <p className="max-w-xl leading-relaxed text-muted-foreground">
          Uma página provisória para conferir a base da interface. As telas da Party chegam na próxima etapa.
        </p>
      </header>
      <section aria-labelledby="buttons-title" className="rounded-xl border bg-card p-6 sm:p-8">
        <h2 id="buttons-title" className="text-lg font-semibold">Componentes compartilhados</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">O mesmo botão, com variantes e estados diferentes. Os exemplos abaixo são demonstrativos.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button type="button">Principal</Button>
          <Button type="button" variant="outline">Contorno</Button>
          <Button type="button" variant="secondary">Secundário</Button>
          <Button type="button" disabled>Indisponível</Button>
        </div>
      </section>
    </main>
  );
}
