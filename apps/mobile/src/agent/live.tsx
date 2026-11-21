import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { frameClock } from "./clock";

/**
 * Living things (agents, orbits) move only on screens that are showing. `LivePause` marks a subtree as
 * off screen (LargeTitleScreen wraps its content with the screen's focus); the shared clock itself is
 * paused while the app is in the background (AppProviders).
 */
const PausedContext = createContext(false);

export function LivePause({ paused, children }: { paused: boolean; children?: ReactNode }) {
  const parent = useContext(PausedContext);
  return <PausedContext.Provider value={parent || paused}>{children}</PausedContext.Provider>;
}

export const useLivePaused = () => useContext(PausedContext);

/** A glide starts right after the finger lifts: the hold waits this long before letting go. */
const SETTLE_MS = 150;

/**
 * Living things hold still while a list moves (`frameClock.hold`): the faces' frames are work on the same thread that
 * places the rows. `hold` when a drag or a glide starts, `settle` when it ends.
 */
export function useStillWhileScrolling() {
  const release = useRef<(() => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hold = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!release.current) release.current = frameClock.hold();
  }, []);
  const settle = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      release.current?.();
      release.current = null;
    }, SETTLE_MS);
  }, []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      release.current?.();
      release.current = null;
    },
    [],
  );
  return { hold, settle };
}

/** The longest a screen's slide holds the clock, in case its end is never told. */
const SLIDE_HOLD_MAX_MS = 900;
let slideRelease: (() => void) | null = null;
let slideTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Living things hold still while a screen slides in or out (`transitionStart` → `transitionEnd` of a stack): the new
 * screen's first render and the slide get the thread to themselves.
 */
export const slideListeners = {
  transitionStart: () => {
    if (!slideRelease) slideRelease = frameClock.hold();
    if (slideTimer) clearTimeout(slideTimer);
    slideTimer = setTimeout(slideEnd, SLIDE_HOLD_MAX_MS);
  },
  transitionEnd: () => slideEnd(),
};

function slideEnd() {
  if (slideTimer) clearTimeout(slideTimer);
  slideTimer = null;
  slideRelease?.();
  slideRelease = null;
}

/**
 * On Android each of these steps is a React render on the JavaScript thread, the thread that also answers taps and
 * feeds the lists: with a few of them on screen at the clock's 25 a second it had no time left, so scrolling stuttered
 * and a tap waited. Pixel marks read the same at 8 steps a second.
 */
const JS_FPS = Platform.OS === "android" ? 8 : undefined;

/**
 * The shared clock's time in seconds, updating ~25 times a second while `active` (and not paused);
 * otherwise `still`. With `fps`, in steps of that rate: the same step again renders nothing, so what costs more to
 * draw (a sticker) stays on the one clock at fewer frames.
 */
export function useFrameTime(active: boolean, still: number, fps?: number): number {
  const paused = useLivePaused();
  const running = active && !paused;
  const [t, setT] = useState(() => (running ? frameClock.time() : still));
  const rate = fps ?? JS_FPS;
  useEffect(() => {
    if (!running) return;
    return frameClock.subscribe(rate ? (now) => setT(Math.floor(now * rate) / rate) : setT);
  }, [running, rate]);
  return running ? t : still;
}
