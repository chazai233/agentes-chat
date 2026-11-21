import { type Expression, nearestPreset } from "@agenteschat/ui/agent/engine";
import { avatarSkyTones } from "@agenteschat/ui/sky/avatar";
import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, Platform, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useReducedMotion, useTheme } from "@/ui/theme";
import { useLivePaused } from "./live";
import type { AgentLookInput } from "./looks";
import { type AgentMode, agentLayout, framedByDefault, framedLayout, seedOf } from "./poses";
import { ACCESSORIES, BODIES, BODY_BOX, type BodyColor, EYES, eyeKind } from "./sprites";

export interface AgentAvatarProps {
  agent: AgentLookInput;
  /** Box size in points (the body sits at the bottom; room above for an accessory). */
  size: number;
  mode?: AgentMode;
  /** false: one still frame (use it in long lists). Default true. */
  live?: boolean;
  /** The agent's name, for screen readers. */
  name?: string;
  /**
   * The agent standing in its own pixel sky, in a rounded tile (like the web's framed avatar). Default:
   * framed from 20 to 63pt; the tiny faces and the big hero stand on their own.
   */
  framed?: boolean;
  /** Holds one face (the sign-in screens: eyes shut while a password is typed); writing still wins. */
  expression?: Expression;
  /**
   * Where it looks for a moment, up or down the screen (at a field being typed in, at a newcomer's row): the eyes and
   * the head turn that way and hold, instead of wandering.
   */
  gaze?: Gaze;
  /** Only its sky, no body (framed only): out on a routine, it comes back into the frame when the run ends. */
  bodyless?: boolean;
  /** The tile's corner radius (framed only). Default: 30% of the side. */
  radius?: number;
}

/** Up or down the screen. */
export type Gaze = "up" | "down";

/** How far the eyes slide toward `gaze`, as a share of the picture's side. */
const GAZE: Record<Gaze, number> = { up: -0.022, down: 0.022 };

/** One beat of each way of moving, in milliseconds (there and back is two). */
const BEAT: Record<AgentMode, number> = { idle: 1900, run: 380, think: 1500, rest: 2600, sleep: 2600 };

/** A blink every few seconds, out of step between agents (`seed` is 0–7). */
const blinkGap = (seed: number) => 2600 + ((seed * 977) % 3400);
const BLINK_MS = 130;
/** The smallest agent that moves on Android. */
const LIVE_MIN = 56;
/** Android decodes each layer at the size it is shown, not at 512 px (less memory, faster to draw while scrolling). */
const DECODE = Platform.OS === "android" ? ({ resizeMethod: "resize" } as const) : {};

function AgentAvatarView({
  agent,
  size,
  mode = "idle",
  live = true,
  name,
  framed,
  expression,
  gaze,
  bodyless = false,
  radius,
}: AgentAvatarProps) {
  const reduced = useReducedMotion();
  const paused = useLivePaused();
  const { scheme, colors: c } = useTheme();
  const { t: tr } = useTranslation();
  const tile = framed ?? framedByDefault(size);
  const { color, eyes, accessory, id } = agent;
  const wears = accessory && accessory !== "none" ? ACCESSORIES[accessory] : undefined;
  const box = tile ? framedLayout(size, Boolean(wears)) : agentLayout(size, Boolean(wears));
  // The pictures are squares with the body at `BODY_BOX`: sized and placed so that body lands on the layout's box.
  const side = box.inner / BODY_BOX.w;
  const left = box.x - BODY_BOX.x * side;
  const top = box.y + box.inner - (BODY_BOX.y + BODY_BOX.h) * side;
  // In a list (small) it holds still on Android: a dozen breathing rows were a dozen animations every frame while
  // the list scrolled. Large (a profile, a hero) it lives.
  const moving = live && !reduced && !paused && (Platform.OS !== "android" || size >= LIVE_MIN);

  // The blink: both pictures stay mounted and trade places, so nothing loads (and nothing flickers) as it shuts.
  const [blinking, setBlinking] = useState(false);
  // Only the open styles shut; a smile or a sleepy line stays as it is (as in the engine).
  const blinks =
    moving &&
    (mode === "idle" || mode === "think") &&
    !expression &&
    (eyes === "round" || eyes === "dots" || eyes === "wide");
  const seed = seedOf(id ?? `${color}:${eyes}:${accessory ?? ""}`);
  useEffect(() => {
    if (!blinks) {
      setBlinking(false);
      return;
    }
    let shut: ReturnType<typeof setTimeout> | undefined;
    const every = setInterval(() => {
      setBlinking(true);
      shut = setTimeout(() => setBlinking(false), BLINK_MS);
    }, blinkGap(seed));
    return () => {
      clearInterval(every);
      clearTimeout(shut);
    };
  }, [blinks, seed]);

  // Its life, on the UI thread: one value going there and back; what it moves depends on what the agent is doing.
  const beat = useSharedValue(0);
  useEffect(() => {
    if (!moving) {
      cancelAnimation(beat);
      beat.value = 0;
      return;
    }
    beat.value = 0;
    beat.value = withRepeat(withTiming(1, { duration: BEAT[mode], easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(beat);
  }, [moving, mode, beat]);
  const figure = useAnimatedStyle(() => {
    const b = beat.value;
    // Working: a small hop, squashed as it lands. Thinking: it sways. Otherwise it breathes (slower asleep).
    if (mode === "run")
      return { transform: [{ translateY: -side * 0.035 * b }, { scaleY: 1 + 0.03 * b }, { scaleX: 1 - 0.02 * b }] };
    if (mode === "think") return { transform: [{ rotateZ: `${(b - 0.5) * 5}deg` }] };
    return { transform: [{ scaleY: 1 + 0.022 * b }, { scaleX: 1 - 0.012 * b }] };
  });

  const shown = eyeKind(eyes, mode, expression, false);
  const look = gaze ? GAZE[gaze] * side : mode === "think" ? -0.016 * side : 0;
  const preset = nearestPreset(color) as BodyColor;
  const picture = { position: "absolute" as const, left: 0, top: 0, width: side, height: side };
  const label = name
    ? tr(mode === "run" ? "mobile.a11y.agentWorking" : "mobile.a11y.agent", { name })
    : tr("mobile.a11y.agentPlain");
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[
        { width: size, height: size },
        tile && {
          borderRadius: radius ?? size * 0.3,
          overflow: "hidden",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: c.line,
          backgroundColor: avatarSkyTones(color, scheme === "dark")[0],
        },
      ]}
    >
      {tile && bodyless ? null : (
        <Animated.View
          style={[{ position: "absolute", left, top, width: side, height: side, transformOrigin: "50% 85%" }, figure]}
        >
          <Image source={BODIES[preset] ?? BODIES.sky} style={picture} fadeDuration={0} {...DECODE} />
          <Image
            source={EYES[shown]}
            style={[picture, { top: look, opacity: blinking ? 0 : 1 }]}
            fadeDuration={0}
            {...DECODE}
          />
          {blinks ? (
            <Image
              source={EYES.blink}
              style={[picture, { top: look, opacity: blinking ? 1 : 0 }]}
              fadeDuration={0}
              {...DECODE}
            />
          ) : null}
          {wears ? <Image source={wears} style={picture} fadeDuration={0} {...DECODE} /> : null}
        </Animated.View>
      )}
    </View>
  );
}

/**
 * An agent, in three dimensions: its body, eyes and accessory are pictures stacked (`./sprites`), and its life (a
 * breath, a blink, a hop while it works) runs on the UI thread, so a list of agents costs the JavaScript thread
 * nothing per frame. With reduced motion, `live={false}`, an off-screen screen or the app in the background it
 * holds still.
 */
export const AgentAvatar = memo(
  AgentAvatarView,
  (a, b) =>
    a.size === b.size &&
    a.mode === b.mode &&
    a.live === b.live &&
    a.name === b.name &&
    a.framed === b.framed &&
    a.expression === b.expression &&
    a.gaze === b.gaze &&
    a.bodyless === b.bodyless &&
    a.radius === b.radius &&
    a.agent.color === b.agent.color &&
    a.agent.eyes === b.agent.eyes &&
    a.agent.accessory === b.agent.accessory &&
    a.agent.id === b.agent.id,
);

/** The engine's flat agent as drawing commands, for what draws outside React (`./frame`). */
export { agentFrame } from "./frame";
