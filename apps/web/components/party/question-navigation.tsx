"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

const QUESTION_ROUTES = ["address", "restrictions", "budget", "energy", "order-style", "desires", "avoid", "waiting"].map((step) => `/party/${step}`);
const QuestionNavigationContext = createContext<((href: string) => void) | null>(null);

export function QuestionNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const pending = useRef<{ finish: () => void; skip: () => void } | null>(null);

  useLayoutEffect(() => {
    pending.current?.finish();
    pending.current = null;
  }, [pathname]);

  useLayoutEffect(() => () => {
    pending.current?.finish();
    pending.current?.skip();
  }, []);

  const navigate = useCallback((href: string) => {
    if (href === pathname) return;
    pending.current?.finish();
    pending.current?.skip();

    if (!QUESTION_ROUTES.includes(pathname) || !QUESTION_ROUTES.includes(href) ||
      !document.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      router.push(href);
      return;
    }

    let timeout: ReturnType<typeof setTimeout>;
    const transition = document.startViewTransition(() => new Promise<void>((resolve) => {
      // O avanço não espera a animação. Só a captura visual aguarda a próxima rota montar.
      const finish = () => { clearTimeout(timeout); resolve(); };
      pending.current = { finish, skip: () => transition.skipTransition() };
      // Se a rota demorar/falhar, libera a captura sem bloquear a navegação.
      timeout = setTimeout(() => { transition.skipTransition(); finish(); }, 1500);
      router.push(href);
    }));
    void transition.finished.catch(() => {});
  }, [pathname, router]);

  return <QuestionNavigationContext.Provider value={navigate}>{children}</QuestionNavigationContext.Provider>;
}

export function useQuestionRouter() {
  const router = useRouter();
  const navigate = useContext(QuestionNavigationContext);
  return { push: navigate ?? router.push };
}
