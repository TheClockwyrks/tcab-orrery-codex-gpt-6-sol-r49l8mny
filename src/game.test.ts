import { describe, expect, it } from "vitest";
import { orreryCore } from "./game";

const place = (
  s: ReturnType<typeof orreryCore.fresh>,
  y: number,
  x: number,
  targetY: number,
) => {
  let next = orreryCore.pointerEvent(s, "down", 70, y);
  next = orreryCore.pointerEvent(next, "move", x, targetY);
  return orreryCore.pointerEvent(next, "up", x, targetY);
};

describe("the machine", () => {
  it("keeps a placed part and restores it with undo", () => {
    let s = orreryCore.open(orreryCore.fresh(), "campaign", 0);
    s = place(s, 71, 616, 304);
    expect(s.editor.parts.map((p) => p.kind)).toEqual(["arm"]);
    s = orreryCore.pointerEvent(s, "down", 616, 304);
    s = orreryCore.pointerEvent(s, "up", 616, 304);
    s = orreryCore.keyboard(s, "part-delete");
    expect(s.editor.parts).toHaveLength(0);
    s = orreryCore.keyboard(s, "undo");
    expect(s.editor.parts.map((p) => p.kind)).toEqual(["arm"]);
  });

  it("ships legal completing machines across the campaign", () => {
    for (let index = 0; index < 8; index++) {
      const initial = orreryCore.open(orreryCore.fresh(), "campaign", index);
      const solution = orreryCore.reference("campaign", index);
      expect(solution.parts.length).toBeGreaterThanOrEqual(index === 0 ? 3 : 4);
      let s = orreryCore.loadSolution(initial, solution);
      s = orreryCore.start(s);
      for (let n = 0; n < 80 && s.sim?.status === "running"; n++)
        s = orreryCore.oneCycle(s);
      expect(s.sim?.status).toBe("complete");
    }
  });

  it("delivers six products through a programmed arm and completes", () => {
    let s = orreryCore.open(orreryCore.fresh(), "campaign", 0);
    s = place(s, 71, 616, 304);
    s = place(s, 102, 664, 304);
    s = place(s, 132, 640, 346);
    const arm = s.editor.parts[0];
    s = {
      ...s,
      editor: {
        ...s.editor,
        parts: [
          { ...arm, tape: ["grab", "rotate-cw", "drop", "rotate-ccw"] },
          ...s.editor.parts.slice(1),
        ],
      },
    };
    s = orreryCore.start(s);
    for (let i = 0; i < 40 && s.sim?.status === "running"; i++)
      s = orreryCore.oneCycle(s);
    expect(s.sim?.status).toBe("complete");
    expect(s.sim?.tallies).toEqual([6]);
    expect(s.sim?.metrics?.cost).toBe(20);
  });
  it("finds a collision during the sweep before the arms reach the next hex", () => {
    let s = orreryCore.open(orreryCore.fresh(), "campaign", 0);
    s = {
      ...s,
      editor: {
        ...s.editor,
        parts: [
          {
            id: 1,
            kind: "arm",
            q: 0,
            r: 0,
            rotation: 0,
            length: 1,
            cells: null,
            closed: null,
            index: null,
            tape: ["rotate-cw"],
          },
        ],
        nextId: 2,
      },
    };
    s = orreryCore.start(s);
    s = {
      ...s,
      sim: {
        ...s.sim!,
        motes: [
          { id: 1, q: 1, r: 0, type: "dust", wheel: null },
          { id: 2, q: 1, r: 1, type: "dust", wheel: null },
        ],
        nextMoteId: 3,
        grips: [{ part: 1, spoke: 0, mote: 1 }],
      },
    };
    s = orreryCore.oneCycle(s);
    expect(s.sim?.status).toBe("faulted");
    expect(s.sim?.fault?.kind).toBe("collision");
    expect(s.sim?.fraction).toBe(3 / 8);
  });
  it("requires a linked chain before a repeating set counts a procession", () => {
    let s = orreryCore.open(orreryCore.fresh(), "extras", 9);
    s = {
      ...s,
      editor: {
        ...s.editor,
        parts: [
          {
            id: 1,
            kind: "set",
            q: 0,
            r: 0,
            rotation: 0,
            length: 1,
            cells: null,
            closed: null,
            index: 0,
            tape: null,
          },
        ],
        nextId: 2,
      },
    };
    s = orreryCore.start(s);
    s = {
      ...s,
      sim: {
        ...s.sim!,
        motes: [{ id: 1, q: 0, r: 0, type: "luna", wheel: null }],
        nextMoteId: 2,
      },
    };
    s = orreryCore.oneCycle(s);
    expect(s.sim?.tallies).toEqual([0]);
    s = {
      ...s,
      sim: {
        ...s.sim!,
        motes: [
          { id: 1, q: 0, r: 0, type: "luna", wheel: null },
          { id: 2, q: 1, r: 0, type: "luna", wheel: null },
        ],
        filaments: [{ a: 1, b: 2, weight: 1 }],
        nextMoteId: 3,
      },
    };
    s = orreryCore.oneCycle(s);
    expect(s.sim?.tallies).toEqual([2]);
  });
  it("completes the First Light reference on the Extras shelf", () => {
    let s = orreryCore.open(orreryCore.fresh(), "extras", 0);
    s = orreryCore.loadSolution(s, orreryCore.reference("extras", 0));
    s = orreryCore.start(s);
    for (let i = 0; i < 40 && s.sim?.status === "running"; i++)
      s = orreryCore.oneCycle(s);
    expect(s.sim?.status).toBe("complete");
  });
});
