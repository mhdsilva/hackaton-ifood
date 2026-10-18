import type { CSSProperties } from "react";

export function SegmentedProgress({ current, total, label, duration = 700, running = true }: {
  current: number;
  total: number;
  label: string;
  duration?: number;
  running?: boolean;
}) {
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={current} className="flex h-[5px] gap-1">
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className="h-full min-w-0 flex-1 overflow-hidden rounded-full bg-secondary">
          <span
            className="party-progress-fill block h-full origin-left rounded-full bg-primary"
            data-state={index < current - 1 ? "complete" : index === current - 1 ? "active" : "pending"}
            data-running={running}
            style={{ "--progress-duration": `${duration}ms` } as CSSProperties}
          />
        </span>
      ))}
    </div>
  );
}
