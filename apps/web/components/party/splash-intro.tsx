"use client";

import Image from "next/image";
import { createContext, useContext, useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { BrandBackdrop } from "@/components/party/brand-backdrop";

const INTRO_DURATION = 2.7;
const SplashCompleteContext = createContext(false);

export function useSplashComplete() { return useContext(SplashCompleteContext); }

export function SplashIntro({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(true);
  const container = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(false);
      return;
    }
    const splash = container.current;
    const wipe = splash?.querySelector<HTMLElement>("[data-splash-wipe]");
    const brand = splash?.querySelector<HTMLElement>("[data-splash-brand]");
    const logo = splash?.querySelector<HTMLElement>("[data-splash-logo]");
    const party = splash?.querySelector<HTMLElement>("[data-splash-party]");
    if (!splash || !wipe || !brand || !logo || !party) return;
    const radius = Math.hypot(splash.clientWidth, splash.clientHeight) / 2 + 1;
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const originalThemeColor = themeColor?.content;
    const darkBackground = getComputedStyle(document.documentElement).getPropertyValue("--background").trim();
    const redBackground = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
    const backgrounds = [splash, document.documentElement, document.body];

    // Safari também usa o fundo do documento para colorir sua interface nativa.
    gsap.set(backgrounds, { backgroundColor: redBackground });
    if (themeColor) themeColor.content = redBackground;

    const timeline = gsap.timeline({
      defaults: { ease: "power2.inOut" },
      onComplete: () => setVisible(false),
    });

    timeline
      .set(wipe, { clipPath: "circle(0px at 50% 50%)" })
      .set(brand, { x: 0 })
      .set(logo, { filter: "brightness(0) invert(1)" })
      .set(party, { autoAlpha: 0, x: -18 })
      .to(wipe, { clipPath: `circle(${radius}px at 50% 50%)`, duration: 0.6, ease: "power3.inOut" }, 0.25)
      // O recorte termina em 0,85s: sincroniza splash, áreas seguras e navegador.
      .set(backgrounds, { backgroundColor: darkBackground }, 0.85)
      .call(() => { if (themeColor) themeColor.content = darkBackground; }, [], 0.85)
      .to(logo, { filter: "brightness(1) invert(0)", duration: 0.45 }, 0.25)
      .to(brand, { x: -(party.offsetWidth + 4) / 2, duration: 0.8, ease: "power3.inOut" }, 0.25)
      .to(party, { autoAlpha: 1, x: 0, duration: 0.55, ease: "power3.out" }, 0.5)
      .to(splash, { xPercent: -100, duration: 0.5, ease: "power3.inOut" }, INTRO_DURATION - 0.5);

    return () => {
      timeline.kill();
      if (themeColor && originalThemeColor !== undefined) themeColor.content = originalThemeColor;
    };
  }, { scope: container, dependencies: [] });

  return (
    <SplashCompleteContext.Provider value={!visible}>
      <div inert={visible} aria-hidden={visible}>
        {children}
      </div>
      {visible && (
        <div
          ref={container}
          data-splash
          role="status"
          aria-label="iFood Party"
          className="fixed inset-0 z-[100] grid min-h-svh place-items-center overflow-hidden bg-[#EA1D2C]"
        >
          <div data-splash-wipe aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden bg-background">
            <BrandBackdrop />
          </div>
          <div data-splash-brand className="relative z-10 h-[42px] w-[76px]">
            <Image
              data-splash-logo
              src="/figma/logo.svg"
              alt="iFood"
              width={76}
              height={42}
              priority
              className="h-auto w-[76px]"
            />
            <span data-splash-party className="absolute top-1/2 left-[calc(100%+4px)] -translate-y-1/2 font-heading text-[29px] leading-none font-extrabold whitespace-nowrap italic text-white">Party</span>
          </div>
          <span className="sr-only">Carregando iFood Party</span>
        </div>
      )}
    </SplashCompleteContext.Provider>
  );
}
