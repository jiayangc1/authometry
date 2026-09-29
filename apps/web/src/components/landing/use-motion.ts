"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * The few motion primitives the landing page needs, without an animation library:
 * visibility and a keyframed tween driven by requestAnimationFrame.
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
