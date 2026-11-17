import type { Expression, EyeStyle } from "@agenteschat/ui/agent/engine";

/**
 * An agent in three dimensions, as layers: one picture of the body per preset colour, one of the eyes per kind, one
 * per accessory, all shot from the same place (512 px squares, clear around the figure), so any colour, eyes and
 * accessory stack into one agent. They are renders of this fork's own model of the engine's agent (the same body,
 * colours, eye styles, expressions and accessories as `@agenteschat/ui/agent/engine` draws flat).
 */

/** Where the body with its feet sits in every picture, as fractions of the square: left, top, width, height. */
export const BODY_BOX = { x: 131 / 512, y: 176 / 512, w: 250 / 512, h: 260 / 512 } as const;

export type BodyColor = "sky" | "indigo" | "violet" | "rose" | "amber" | "green" | "teal" | "graphite";

export const BODIES: Record<BodyColor, number> = {
  sky: require("../../assets/agent3d/body-sky.png"),
  indigo: require("../../assets/agent3d/body-indigo.png"),
  violet: require("../../assets/agent3d/body-violet.png"),
  rose: require("../../assets/agent3d/body-rose.png"),
  amber: require("../../assets/agent3d/body-amber.png"),
  green: require("../../assets/agent3d/body-green.png"),
  teal: require("../../assets/agent3d/body-teal.png"),
  graphite: require("../../assets/agent3d/body-graphite.png"),
};

/** The eye pictures: the five styles, the passing expressions (`xhappy` is the expression "happy"), and the poses. */
export type EyeKind = EyeStyle | Exclude<Expression, "happy"> | "xhappy" | "writing" | "blink";

export const EYES: Record<EyeKind, number> = {
  round: require("../../assets/agent3d/eyes-round.png"),
  dots: require("../../assets/agent3d/eyes-dots.png"),
  wide: require("../../assets/agent3d/eyes-wide.png"),
  happy: require("../../assets/agent3d/eyes-happy.png"),
  sleepy: require("../../assets/agent3d/eyes-sleepy.png"),
  closed: require("../../assets/agent3d/eyes-closed.png"),
  xhappy: require("../../assets/agent3d/eyes-xhappy.png"),
  dizzy: require("../../assets/agent3d/eyes-dizzy.png"),
  heart: require("../../assets/agent3d/eyes-heart.png"),
  star: require("../../assets/agent3d/eyes-star.png"),
  cross: require("../../assets/agent3d/eyes-cross.png"),
  surprised: require("../../assets/agent3d/eyes-surprised.png"),
  angry: require("../../assets/agent3d/eyes-angry.png"),
  wink: require("../../assets/agent3d/eyes-wink.png"),
  writing: require("../../assets/agent3d/eyes-writing.png"),
  blink: require("../../assets/agent3d/eyes-blink.png"),
};

/** The engine's accessories by name; a name not here draws nothing. */
export const ACCESSORIES: Record<string, number> = {
  hat: require("../../assets/agent3d/acc-hat.png"),
  cap: require("../../assets/agent3d/acc-cap.png"),
  headphones: require("../../assets/agent3d/acc-headphones.png"),
  bow: require("../../assets/agent3d/acc-bow.png"),
  crown: require("../../assets/agent3d/acc-crown.png"),
  antenna: require("../../assets/agent3d/acc-antenna.png"),
  headset: require("../../assets/agent3d/acc-headset.png"),
  beanie: require("../../assets/agent3d/acc-beanie.png"),
  party: require("../../assets/agent3d/acc-party.png"),
  flower: require("../../assets/agent3d/acc-flower.png"),
  scarf: require("../../assets/agent3d/acc-scarf.png"),
};

/** This fork's mark: the white agent on its tile (512 px, the tile at 56–456, as the launch image). */
export const MARK: number = require("../../assets/agent3d/mark.png");

/** The styles whose eyes shut for a blink (the others are already a line or an arc). */
const BLINKS: ReadonlySet<string> = new Set(["round", "dots", "wide"]);

/**
 * Which eyes an agent shows: writing while it works (it wins over a held face, as in the engine), the held
 * expression, shut while it rests, a blink in passing, and otherwise its own style.
 */
export function eyeKind(
  style: string | undefined,
  mode: string,
  expression: Expression | undefined,
  blinking: boolean,
): EyeKind {
  if (mode === "run") return "writing";
  if (expression) return expression === "happy" ? "xhappy" : expression;
  if (mode === "rest" || mode === "sleep") return "closed";
  const own = style && style in EYES ? (style as EyeKind) : "round";
  return blinking && BLINKS.has(own) ? "blink" : own;
}
