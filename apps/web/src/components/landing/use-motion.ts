"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * The few motion primitives the landing page needs, without an animation library:
 * visibility, scroll progress, and a keyframed tween driven by requestAnimationFrame.
 */

export function useInView(
  target: RefObject<Element | null>,
  { amount = 0, once = false }: { amount?: number; once?: boolean } = {},
): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = target.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = Boolean(entry?.isIntersecting);
        setInView(visible);
        if (visible && once) observer.disconnect();
      },
      { threshold: amount },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [amount, once, target]);

  return inView;
}

/** Progress from the target's top meeting the viewport top (0) to its bottom meeting the viewport bottom (1). */
export function useScrollProgress(
  target: RefObject<Element | null>,
  onProgress: (progress: number) => void,
): void {
  const callback = useRef(onProgress);
  useEffect(() => {
    callback.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const element = target.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const distance = rect.height - window.innerHeight;
      const progress = distance > 0 ? -rect.top / distance : rect.top <= 0 ? 1 : 0;
      callback.current(Math.min(1, Math.max(0, progress)));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [target]);
}

export type Easing = "linear" | [number, number, number, number];

function cubicBezier([x1, y1, x2, y2]: [number, number, number, number]) {
  const sample = (a: number, b: number, t: number) =>
    3 * a * (1 - t) * (1 - t) * t + 3 * b * (1 - t) * t * t + t * t * t;
  return (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const error = sample(x1, x2, t) - x;
      const slope = 3 * x1 * (1 - t) * (1 - t) + 6 * (x2 - x1) * (1 - t) * t + 3 * (1 - x2) * t * t;
      if (Math.abs(error) < 1e-5 || slope === 0) break;
      t = Math.min(1, Math.max(0, t - error / slope));
    }
    return sample(y1, y2, t);
  };
}

/**
 * Plays `values` over `durations` (one per segment) and reports each frame's value.
 * Returns a function that stops playback.
 */
export function playKeyframes(
  values: number[],
  durations: number[],
  easings: Easing[],
  onUpdate: (value: number) => void,
): () => void {
  const curves = easings.map((easing) =>
    easing === "linear" ? (x: number) => x : cubicBezier(easing),
  );
  const total = durations.reduce((sum, value) => sum + value, 0);
  let start = 0;
  let frame = requestAnimationFrame(function tick(now) {
    if (!start) start = now;
    let elapsed = Math.min(total, now - start);
    let segment = 0;
    while (segment < durations.length - 1 && elapsed > durations[segment]!) {
      elapsed -= durations[segment]!;
      segment++;
    }
    const fraction = durations[segment] ? Math.min(1, elapsed / durations[segment]!) : 1;
    const from = values[segment]!;
    const to = values[segment + 1]!;
    onUpdate(from + (to - from) * curves[segment]!(fraction));
    if (now - start < total) frame = requestAnimationFrame(tick);
  });
  return () => cancelAnimationFrame(frame);
}
