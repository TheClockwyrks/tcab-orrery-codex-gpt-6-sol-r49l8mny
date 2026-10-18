/* global document, KeyboardEvent */
import { createEngine, ConstantClock } from "@clockwyrks/simple-2d";
import { game, BACKGROUND } from "../src/game.ts";
import { STAGE_W, STAGE_H, LAYOUT } from "../src/constants.ts";
export async function capture() {
  const canvas = document.getElementById("capture");
  const engine = createEngine({
    canvas,
    width: STAGE_W,
    height: STAGE_H,
    game,
    background: BACKGROUND,
    layout: LAYOUT,
    clock: new ConstantClock(1000 / 60),
  });
  await engine.initialize();
  const d = engine.debug;
  engine.apply((s) => d.openChallenge(s, "campaign", 0));
  engine.startRecording();
  await engine.advance(60);
  const drag = async (y, x, yy) => {
    engine.apply((s) => d.pointerDown(s, 70, y));
    await engine.advance(8);
    engine.apply((s) => d.pointerMove(s, x, yy));
    await engine.advance(8);
    engine.apply((s) => d.pointerUp(s));
    await engine.advance(24);
  };
  await drag(71, 616, 304);
  await drag(102, 664, 304);
  await drag(132, 640, 346);
  const building = canvas.toDataURL("image/png");
  engine.apply((s) => d.pointerDown(s, 325, 570));
  engine.apply((s) => d.pointerUp(s));
  const key = async (code) => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { code, bubbles: true }),
    );
    await engine.advance(1);
    document.dispatchEvent(new KeyboardEvent("keyup", { code, bubbles: true }));
    await engine.advance(15);
  };
  for (const code of ["KeyG", "KeyD", "KeyV", "KeyA"]) await key(code);
  await key("Space");
  await engine.advance(14);
  const running = canvas.toDataURL("image/png");
  await engine.advance(536);
  const solved = canvas.toDataURL("image/png");
  await engine.advance(120);
  const recording = engine.stopRecording();
  const snapshot = d.snapshot(engine.state);
  const status = snapshot.sim?.status;
  engine.destroy();
  return { recording, building, running, solved, status, snapshot };
}
