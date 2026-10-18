"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

export function PreparationTitle({ titles, current }: { titles: readonly string[]; current: number }) {
  const container = useRef<HTMLHeadingElement>(null);

  useGSAP(() => {
    const layers = container.current?.querySelectorAll<HTMLElement>("[data-title-layer]");
    if (!layers) return;
    const incoming = layers[current];
    const outgoing = layers[current - 1];
    if (!incoming) return;

    const media = gsap.matchMedia();
    media.add({ reduced: "(prefers-reduced-motion: reduce)", animated: "(prefers-reduced-motion: no-preference)" }, (context) => {
      gsap.set(layers, { visibility: "hidden" });
      gsap.set(incoming, { visibility: "visible" });
      const incomingWords = incoming.querySelectorAll("[data-title-word]");

      if (context.conditions?.reduced || !outgoing) {
        gsap.set(incomingWords, { yPercent: 0, opacity: 1 });
        return;
      }

      gsap.set(outgoing, { visibility: "visible" });
      gsap.set(incomingWords, { yPercent: 110, opacity: 0.2 });
      gsap.timeline()
        .to(outgoing.querySelectorAll("[data-title-word]"), {
          yPercent: -110,
          opacity: 0,
          duration: 0.32,
          stagger: 0.014,
          ease: "power2.in",
        })
        .to(incomingWords, {
          yPercent: 0,
          opacity: 1,
          duration: 0.52,
          stagger: 0.018,
          ease: "power3.out",
        }, 0.08)
        .set(outgoing, { visibility: "hidden" });
    });
    return () => media.revert();
  }, { scope: container, dependencies: [current, titles], revertOnUpdate: true });

  return (
    <h1 ref={container} className="grid font-preparation text-5xl leading-[1.2] font-bold">
      <span className="sr-only">{titles[current]}</span>
      {titles.map((title, index) => (
        <span key={title} data-title-layer aria-hidden="true" className="col-start-1 row-start-1" style={{ visibility: index === current ? "visible" : "hidden" }}>
          {title.split(" ").map((word, wordIndex) => (
            <span key={`${wordIndex}-${word}`}>
              <span className="inline-block overflow-hidden align-top pb-[0.08em] -mb-[0.08em]">
                <span data-title-word className="inline-block">{word}</span>
              </span>
              {wordIndex < title.split(" ").length - 1 ? " " : null}
            </span>
          ))}
        </span>
      ))}
    </h1>
  );
}
