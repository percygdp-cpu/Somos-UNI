"use client";

import type { ReactNode } from "react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";

interface ConfettiOptions {
  particleCount?: number;
  angle?: number;
  spread?: number;
  startVelocity?: number;
  decay?: number;
  gravity?: number;
  drift?: number;
  flat?: boolean;
  ticks?: number;
  origin?: { x?: number; y?: number };
  colors?: string[];
  shapes?: ("square" | "circle")[];
  scalar?: number;
  zIndex?: number;
  disableForReducedMotion?: boolean;
}

export interface ConfettiRef {
  fire: (options?: ConfettiOptions) => void;
}

interface ConfettiProps {
  options?: ConfettiOptions;
  globalOptions?: ConfettiOptions;
  manualstart?: boolean;
  children?: ReactNode;
  className?: string;
  onMouseEnter?: () => void;
}

const Confetti = forwardRef<ConfettiRef, ConfettiProps>((props, ref) => {
  const { options, globalOptions = { resize: true, useWorker: true }, manualstart = false, children, className = "", onMouseEnter } = props;
  const instanceRef = useRef<any>(null);

  const canvasRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      if (node !== null) {
        if (instanceRef.current) return;
        instanceRef.current = (window as any).confetti?.create(node, {
          ...globalOptions,
          resize: true,
        });
      } else {
        if (instanceRef.current) {
          instanceRef.current.reset();
          instanceRef.current = null;
        }
      }
    },
    [globalOptions]
  );

  const fire = useCallback(
    (opts = {}) => instanceRef.current?.({ ...options, ...opts }),
    [options]
  );

  const api = useMemo(
    () => ({
      fire,
    }),
    [fire]
  );

  useImperativeHandle(ref, () => api, [api]);

  useEffect(() => {
    if (!manualstart) {
      fire();
    }
  }, [manualstart, fire]);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className={className} onMouseEnter={onMouseEnter}>
      {children}
    </canvas>
  );
});

Confetti.displayName = "Confetti";

export { Confetti };

