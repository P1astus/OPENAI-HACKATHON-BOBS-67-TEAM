import { Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type DemoPaneProps = {
  label: string;
  src: string;
  width: number;
  phone: boolean;
  current: boolean;
  focused: boolean;
  hidden?: boolean;
  className: string;
  onToggleFocus: () => void;
};

export function DemoPane({
  label,
  src,
  width,
  phone,
  current,
  focused,
  hidden,
  className,
  onToggleFocus,
}: DemoPaneProps) {
  const frameSpace = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ scale: 0, height: 0 });

  useEffect(() => {
    const space = frameSpace.current;
    if (!space) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width: availableWidth, height: availableHeight } = entry.contentRect;
      if (availableWidth === 0 || availableHeight === 0) return;

      const scale = availableWidth / width;
      setFrame({ scale, height: availableHeight / scale });
    });
    observer.observe(space);
    return () => observer.disconnect();
  }, [width]);

  return (
    <section
      aria-label={label}
      className={`${hidden ? "hidden" : "flex"} min-h-0 min-w-0 flex-col gap-2.5 ${className}`}
    >
      <button
        type="button"
        aria-pressed={focused}
        aria-current={current ? "step" : undefined}
        title={label}
        onClick={onToggleFocus}
        className="section-label flex h-9 w-full shrink-0 cursor-pointer items-center justify-between gap-2 rounded-lg px-2 text-left font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary aria-[current=step]:text-primary aria-pressed:bg-muted"
      >
        <span className="truncate">{label}</span>
        {focused ? (
          <Minimize2 aria-hidden="true" className="size-3.5 shrink-0" />
        ) : (
          <Maximize2 aria-hidden="true" className="size-3.5 shrink-0" />
        )}
      </button>
      <div
        ref={frameSpace}
        className={`shadow-soft relative min-h-0 flex-1 overflow-hidden bg-white ${phone ? "rounded-[44px] border-[5px] border-zinc-800" : "rounded-2xl"} ${current ? "outline-2 outline-offset-2 outline-primary" : "outline-1 outline-border"}`}
      >
        <iframe
          src={src}
          aria-label={label}
          width={width}
          className="absolute left-0 top-0 block origin-top-left border-0"
          style={{ height: frame.height, transform: `scale(${frame.scale})` }}
        />
      </div>
    </section>
  );
}
