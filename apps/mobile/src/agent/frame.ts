import {
  bodyTones,
  drawAccessory,
  drawAgent,
  drawSleep,
  type Expression,
  EYE_COLOR,
} from "@agenteschat/ui/agent/engine";
import { avatarSkyCell, avatarSkyCells, avatarSkyTones } from "@agenteschat/ui/sky/avatar";
import type { Gaze } from "./AgentAvatar";
import type { AgentLookInput } from "./looks";
import { type AgentMode, agentLayout, framedLayout, poseFor, STILL_T } from "./poses";
import { asCtx, compile, RecordingContext } from "./recorder";

/*
 * The engine's flat agent as drawing commands, for what draws outside React (the Live Activity's faces,
 * `features/live-activity/faces.ts`). The app's own faces are the 3D pictures of `AgentAvatar`; this keeps the
 * engine's drawing (as upstream's AgentAvatar has it) where only commands will do.
 */

/** The eyes and the head turned toward `gaze` (fractions of the body, as the engine's `look` and `turn`). */
const GAZE: Record<Gaze, { look: [number, number]; turn: [number, number] }> = {
  up: { look: [0, -0.14], turn: [0, -0.35] },
  down: { look: [0, 0.14], turn: [0, 0.35] },
};

/** One frame of an agent as drawing commands (the engine draws, the recorder keeps the commands). */

export function agentFrame(
  agent: AgentLookInput,
  size: number,
  mode: AgentMode,
  t: number,
  seed: number,
  reduced: boolean,
  frame?: { dark: boolean },
  expression?: Expression,
  dark = frame?.dark ?? false,
  extra?: { gaze?: Gaze | undefined; bodyless?: boolean | undefined; sky?: boolean | undefined },
) {
  const accessory = agent.accessory && agent.accessory !== "none" ? agent.accessory : undefined;
  const box = frame ? framedLayout(size, Boolean(accessory)) : agentLayout(size, Boolean(accessory));
  const rec = new RecordingContext();
  if (frame && extra?.sky !== false) drawSky(rec, agent.color, size, frame.dark);
  // Away on a routine: the frame keeps its sky and waits for it.
  if (frame && extra?.bodyless) return compile(rec.commands);
  const base = poseFor(mode, t, seed, reduced);
  const looked = extra?.gaze ? { ...base, ...GAZE[extra.gaze] } : base;
  drawAgent(asCtx(rec), box.x, box.y, box.inner, {
    color: agent.color,
    eyes: agent.eyes,
    cells: box.cells,
    pose: expression ? { ...looked, expression, blink: false } : looked,
    after: (ctx, side, body) => {
      if (box.withAccessory && accessory) drawAccessory(ctx, side, accessory, body, t, mode === "run");
      // A sleeping agent's zz: the body's darkest tone on a light page, white on a dark one.
      if (mode === "sleep")
        drawSleep(
          ctx,
          side,
          body,
          dark ? EYE_COLOR : (bodyTones(agent.color)[0] ?? EYE_COLOR),
          // A still frame shows both z's.
          reduced || t === STILL_T ? undefined : t,
        );
    },
  });
  return compile(rec.commands);
}

/** The tile's sky (`@agenteschat/ui/sky/avatar`): a Bayer dither from the top tone to the bottom one. */

function drawSky(rec: RecordingContext, color: AgentLookInput["color"], size: number, dark: boolean) {
  const [top, bottom] = avatarSkyTones(color, dark);
  const n = avatarSkyCells(size * 2);
  const cell = size / n;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      rec.fillStyle = avatarSkyCell(x, y, n) ? bottom : top;
      rec.fillRect(x * cell, y * cell, cell, cell);
    }
}

/**
 * Pictures kept across mounts, most recently used last: a face scrolled back into view, the same agent in many rows,
 * a sky under every frame of a living face. Recording one costs hundreds of rects and a path parse each.
 */
