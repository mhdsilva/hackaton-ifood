"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

const INTRO_DURATION = 2.7;

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
      // Alinha a cor real da splash ao fundo revelado, inclusive fora do recorte.
      .set(splash, { backgroundColor: "#1c1c1c" })
      .to(logo, { filter: "brightness(1) invert(0)", duration: 0.45 }, 0.25)
      .to(brand, { x: -(party.offsetWidth + 4) / 2, duration: 0.8, ease: "power3.inOut" }, 0.25)
      .to(party, { autoAlpha: 1, x: 0, duration: 0.55, ease: "power3.out" }, 0.5)
      .to(splash, { xPercent: -100, duration: 0.5, ease: "power3.inOut" }, INTRO_DURATION - 0.5);

    return () => timeline.kill();
  }, { scope: container, dependencies: [] });

  return (
    <>
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
            <div className="splash-artwork"><div className="splash-pattern" /></div>
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
    </>
  );
}
