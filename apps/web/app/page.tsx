import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col justify-center gap-10 px-6 py-12 sm:px-10">
      <header className="space-y-4">
        <p className="text-sm font-medium text-muted-foreground">iFood Party</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Nossa próxima experiência começa aqui.</h1>
        <p className="max-w-xl leading-relaxed text-muted-foreground">
          As telas da Party chegam na próxima etapa. Enquanto isso, confira os componentes compartilhados da interface.
        </p>
      </header>
      <Link href="/dev/components" className="w-fit rounded-md text-sm font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
        Ver vitrine de componentes
      </Link>
    </main>
  );
}
