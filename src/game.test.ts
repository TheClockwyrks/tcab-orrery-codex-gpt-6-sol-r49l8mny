import { describe, expect, it } from "vitest";
import { PARTS } from "./constants";
import { orreryCore, type TapeCell } from "./game";

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
    const sizes: number[] = [];
    const periods: number[] = [];
    const offered = new Set<string>();
    const placed = new Set<string>();
    for (let index = 0; index < 8; index++) {
      const initial = orreryCore.open(orreryCore.fresh(), "campaign", index);
      const solution = orreryCore.reference("campaign", index);
      for (const kind of initial.challenge!.permitted) offered.add(kind);
      for (const part of solution.parts) placed.add(part.kind);
      sizes.push(solution.parts.length);
      periods.push(
        Math.max(0, ...solution.parts.map((p) => p.tape?.length ?? 0)),
      );
      expect(solution.parts.length).toBeGreaterThanOrEqual(index === 0 ? 3 : 4);
      let s = orreryCore.loadSolution(initial, solution);
      s = orreryCore.start(s);
      for (let n = 0; n < 600 && s.sim?.status === "running"; n++)
        s = orreryCore.oneCycle(s);
      expect(s.sim?.status).toBe("complete");
    }
    expect(sizes[0]).toBeLessThanOrEqual(3);
    expect(sizes[7]).toBeGreaterThanOrEqual(8);
    expect(sizes[7]).toBeGreaterThan(Math.max(...sizes.slice(0, 7)));
    expect(periods[7]).toBeGreaterThan(Math.max(...periods.slice(0, 7)));
    for (let i = 2; i < sizes.length; i++)
      expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i - 2]);
    expect([...offered].sort()).toEqual([...PARTS.slice(0, -2)].sort());
    expect([...placed].sort()).toEqual([...PARTS].sort());
    const opener = orreryCore.open(
      orreryCore.fresh(),
      "campaign",
      0,
    ).challenge!;
    const later = orreryCore.open(orreryCore.fresh(), "campaign", 2).challenge!;
    expect(later.reagents).toContainEqual(opener.products[0]);
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
  it("ships completing references for every Extras challenge", () => {
    for (let index = 0; index < 10; index++) {
      let s = orreryCore.open(orreryCore.fresh(), "extras", index);
      s = orreryCore.loadSolution(s, orreryCore.reference("extras", index));
      s = orreryCore.start(s);
      for (let n = 0; n < 160 && s.sim?.status === "running"; n++)
        s = orreryCore.oneCycle(s);
      expect(s.sim?.status, `Extras challenge ${index}`).toBe("complete");
    }
  });
  it("solves Twin Moons with two coordinated arms", () => {
    let s = orreryCore.open(orreryCore.fresh(), "extras", 1);
    const tape1: TapeCell[] = [
      "grab",
      "rotate-cw",
      "rotate-cw",
      "drop",
      "rotate-ccw",
      "rotate-ccw",
      "grab",
      "rotate-cw",
      "drop",
      "rotate-ccw",
    ];
    const tape2: TapeCell[] = [
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      "grab",
      "rotate-cw",
      "drop",
      "rotate-ccw",
    ];
    s = orreryCore.loadSolution(s, {
      parts: [
        { kind: "rise", index: 0, q: 2, r: 0, rotation: 0 },
        { kind: "set", index: 0, q: -1, r: 1, rotation: 1 },
        { kind: "bind", q: 0, r: 1, rotation: 0 },
        { kind: "arm", q: 1, r: 0, rotation: 0, length: 1, tape: tape1 },
        { kind: "arm", q: 0, r: 0, rotation: 1, length: 1, tape: tape2 },
      ],
    });
    s = orreryCore.start(s);
    for (let i = 0; i < 150 && s.sim?.status === "running"; i++)
      s = orreryCore.oneCycle(s);
    expect(s.sim?.status).toBe("complete");
  });
  it("solves Waning Crescent through wane and bind", () => {
    let s = orreryCore.open(orreryCore.fresh(), "extras", 2);
    const tape1: TapeCell[] = [
      "grab",
      "rotate-cw",
      "rotate-cw",
      "rotate-cw",
      "drop",
      "rotate-ccw",
      "rotate-ccw",
      "rotate-ccw",
      "grab",
      "rotate-cw",
      "rotate-cw",
      "drop",
      "rotate-ccw",
      "rotate-ccw",
    ];
    const tape2: TapeCell[] = [
      ...Array(12).fill(null),
      "grab",
      "rotate-cw",
      "drop",
      "rotate-ccw",
    ];
    s = orreryCore.loadSolution(s, {
      parts: [
        { kind: "rise", index: 0, q: 2, r: 0, rotation: 0 },
        { kind: "set", index: 0, q: -1, r: 1, rotation: 2 },
        { kind: "wane", q: 1, r: 1, rotation: 0 },
        { kind: "bind", q: 0, r: 0, rotation: 1 },
        { kind: "arm", q: 1, r: 0, rotation: 0, length: 1, tape: tape1 },
        { kind: "arm", q: -1, r: 0, rotation: 0, length: 1, tape: tape2 },
      ],
    });
    s = orreryCore.start(s);
    for (let i = 0; i < 180 && s.sim?.status === "running"; i++)
      s = orreryCore.oneCycle(s);
    expect(s.sim?.status).toBe("complete");
  });
  it("solves Trine with the triune sigil", () => {
    let s = orreryCore.open(orreryCore.fresh(), "extras", 8);
    const tape1: TapeCell[] = [
      "grab",
      "rotate-cw",
      "rotate-cw",
      "drop",
      "rotate-ccw",
      "rotate-ccw",
      "grab",
      "rotate-cw",
      "drop",
      "rotate-ccw",
    ];
    const tape2: TapeCell[] = [
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      "grab",
      "rotate-cw",
      "drop",
      "rotate-ccw",
    ];
    s = orreryCore.loadSolution(s, {
      parts: [
        { kind: "rise", index: 0, q: 2, r: 0, rotation: 0 },
        { kind: "set", index: 0, q: -1, r: 1, rotation: 1 },
        { kind: "triune", q: 0, r: 1, rotation: 0 },
        { kind: "arm", q: 1, r: 0, rotation: 0, length: 1, tape: tape1 },
        { kind: "arm", q: 0, r: 0, rotation: 1, length: 1, tape: tape2 },
      ],
    });
    s = orreryCore.start(s);
    for (let i = 0; i < 150 && s.sim?.status === "running"; i++)
      s = orreryCore.oneCycle(s);
    expect(s.sim?.status).toBe("complete");
  });
  it("solves Great Conjunction by combining two Venus motes", () => {
    let s = orreryCore.open(orreryCore.fresh(), "extras", 5);
    const tape1: TapeCell[] = [
      "grab",
      "rotate-cw",
      "rotate-cw",
      "drop",
      "rotate-ccw",
      "rotate-ccw",
      "grab",
      "rotate-cw",
      "drop",
      "rotate-ccw",
    ];
    const tape2: TapeCell[] = [
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      "grab",
      "rotate-cw",
      "drop",
      "rotate-ccw",
    ];
    s = orreryCore.loadSolution(s, {
      parts: [
        { kind: "rise", index: 0, q: 2, r: 0, rotation: 0 },
        { kind: "set", index: 0, q: -1, r: 2, rotation: 0 },
        { kind: "conjoin", q: 0, r: 1, rotation: 0 },
        { kind: "arm", q: 1, r: 0, rotation: 0, length: 1, tape: tape1 },
        { kind: "arm", q: 0, r: 1, rotation: 1, length: 1, tape: tape2 },
      ],
    });
    s = orreryCore.start(s);
    for (let i = 0; i < 150 && s.sim?.status === "running"; i++)
      s = orreryCore.oneCycle(s);
    expect(s.sim?.status).toBe("complete");
  });
  it("solves Ascendant with two feeds and an ascending sigil", () => {
    let s = orreryCore.open(orreryCore.fresh(), "extras", 4);
    const a: TapeCell[] = [
      "grab",
      "rotate-cw",
      "rotate-cw",
      "drop",
      "rotate-ccw",
      "rotate-ccw",
    ];
    const b: TapeCell[] = [
      null,
      null,
      null,
      "grab",
      "rotate-cw",
      "rotate-cw",
      "drop",
      "rotate-ccw",
      "rotate-ccw",
    ];
    const c: TapeCell[] = [
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      "grab",
      "rotate-cw",
      "drop",
      "rotate-ccw",
    ];
    s = orreryCore.loadSolution(s, {
      parts: [
        { kind: "rise", index: 0, q: 2, r: 0, rotation: 0 },
        { kind: "rise", index: 1, q: 3, r: 0, rotation: 0 },
        { kind: "set", index: 0, q: 0, r: 2, rotation: 0 },
        { kind: "ascend", q: 0, r: 1, rotation: 0 },
        { kind: "arm", q: 1, r: 0, rotation: 0, length: 1, tape: a },
        { kind: "arm", q: 2, r: 0, rotation: 0, length: 1, tape: b },
        { kind: "arm", q: 0, r: 1, rotation: 0, length: 1, tape: c },
      ],
    });
    s = orreryCore.start(s);
    for (let i = 0; i < 160 && s.sim?.status === "running"; i++)
      s = orreryCore.oneCycle(s);
    expect(s.sim?.status).toBe("complete");
  });
  it("solves Procession by delivering linked pairs", () => {
    let s = orreryCore.open(orreryCore.fresh(), "extras", 9);
    const tape1: TapeCell[] = [
      "grab",
      "rotate-cw",
      "rotate-cw",
      "drop",
      "rotate-ccw",
      "rotate-ccw",
      "grab",
      "rotate-cw",
      "drop",
      "rotate-ccw",
    ];
    const tape2: TapeCell[] = [
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      "grab",
      "rotate-cw",
      "drop",
      "rotate-ccw",
    ];
    s = orreryCore.loadSolution(s, {
      parts: [
        { kind: "rise", index: 0, q: 2, r: 0, rotation: 0 },
        { kind: "set", index: 0, q: -1, r: 1, rotation: 1 },
        { kind: "bind", q: 0, r: 1, rotation: 0 },
        { kind: "arm", q: 1, r: 0, rotation: 0, length: 1, tape: tape1 },
        { kind: "arm", q: 0, r: 0, rotation: 1, length: 1, tape: tape2 },
      ],
    });
    s = orreryCore.start(s);
    for (let i = 0; i < 100 && s.sim?.status === "running"; i++)
      s = orreryCore.oneCycle(s);
    expect(s.sim?.status).toBe("complete");
  });
});
