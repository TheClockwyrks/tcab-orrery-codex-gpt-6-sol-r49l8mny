import type {
  Game,
  InitApi,
  UpdateApi,
  RenderApi,
} from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import * as C from "./constants";

export type Screen = "title" | "howto" | "select" | "editor";

export type Mode = "campaign" | "extras";

export type MoteType =
  | "dust"
  | "nebula"
  | "comet"
  | "nova"
  | "meteor"
  | "mercury"
  | "saturn"
  | "jupiter"
  | "mars"
  | "venus"
  | "luna"
  | "sol"
  | "umbra"
  | "lumen"
  | "aether";

export type PartKind =
  | "arm"
  | "biarm"
  | "triarm"
  | "hexarm"
  | "piston"
  | "wheel"
  | "track"
  | "bind"
  | "manifold"
  | "triune"
  | "sunder"
  | "wane"
  | "mirror"
  | "ascend"
  | "conjoin"
  | "eclipse"
  | "confluence"
  | "dispersion"
  | "void"
  | "rise"
  | "set";

export type Instruction =
  | "grab"
  | "drop"
  | "rotate-cw"
  | "rotate-ccw"
  | "pivot-cw"
  | "pivot-ccw"
  | "extend"
  | "retract"
  | "advance"
  | "recede";

export type TapeCell = Instruction | null;

export type SimStatus = "running" | "paused" | "faulted" | "complete";

export type FaultKind =
  | "collision"
  | "torn"
  | "overextended"
  | "overretracted"
  | "unmounted"
  | "track-end"
  | "impossible";

export type Focus = "field" | "tape";

export interface Hex {
  readonly q: number;
  readonly r: number;
}

export interface PatternFilament {
  readonly a: Hex;
  readonly b: Hex;
  readonly weight: number;
}

export interface Molecule {
  readonly motes: readonly {
    readonly q: number;
    readonly r: number;
    readonly type: MoteType;
  }[];
  readonly filaments: readonly PatternFilament[];
  readonly repeat: {
    readonly vector: Hex;
    readonly link: PatternFilament;
  } | null;
}

export interface Challenge {
  readonly name: string;
  readonly reagents: readonly Molecule[];
  readonly products: readonly Molecule[];
  readonly permitted: readonly PartKind[];
  readonly target: number;
}

export interface PartState {
  readonly id: number;
  readonly kind: PartKind;
  readonly q: number;
  readonly r: number;
  readonly rotation: number;
  readonly length: number;
  readonly cells: readonly Hex[] | null;
  readonly closed: boolean | null;
  readonly index: number | null;
  readonly tape: readonly TapeCell[] | null;
}

export type DragState =
  | {
      readonly kind: "place";
      readonly part: PartKind;
      readonly index: number | null;
      readonly rotation: number;
      readonly length: number;
      readonly at: Hex | null;
      readonly before: readonly PartState[];
    }
  | {
      readonly kind: "move";
      readonly part: number;
      readonly from: Hex;
      readonly at: Hex | null;
      readonly rotation: number;
      readonly length: number;
      readonly before: readonly PartState[];
    }
  | {
      readonly kind: "lay";
      readonly part: number;
      readonly end: "first" | "last";
      readonly before: readonly PartState[];
    };

export interface EditorState {
  readonly parts: readonly PartState[];
  readonly nextId: number;
  readonly selected: number | null;
  readonly focus: Focus;
  readonly cursor: { readonly part: number; readonly col: number } | null;
  readonly drag: DragState | null;
  readonly undo: readonly (readonly PartState[])[];
  readonly redo: readonly (readonly PartState[])[];
}

export interface MoteState {
  readonly id: number;
  readonly q: number;
  readonly r: number;
  readonly type: MoteType;
  readonly wheel: number | null;
}

export interface SimFilament {
  readonly a: number;
  readonly b: number;
  readonly weight: number;
}

export interface Pose {
  readonly part: number;
  readonly rotation: number;
  readonly length: number;
  readonly cell: Hex;
}

export interface Grip {
  readonly part: number;
  readonly spoke: number;
  readonly mote: number;
}

export interface Metrics {
  readonly cost: number;
  readonly cycles: number;
  readonly area: number;
}

export interface SimState {
  readonly status: SimStatus;
  readonly cycle: number;
  readonly fraction: number;
  readonly speed: number;
  readonly motes: readonly MoteState[];
  readonly nextMoteId: number;
  readonly filaments: readonly SimFilament[];
  readonly poses: readonly Pose[];
  readonly grips: readonly Grip[];
  readonly tallies: readonly number[];
  readonly areaHexes: readonly Hex[];
  readonly fault: {
    readonly kind: FaultKind;
    readonly parts: readonly number[];
    readonly motes: readonly number[];
  } | null;
  readonly metrics: Metrics | null;
}

export interface PointerState {
  readonly x: number;
  readonly y: number;
  readonly down: boolean;
}

export interface OrreryState {
  readonly screen: Screen;
  readonly mode: Mode;
  readonly menuIndex: number;
  readonly titleIndex: number;
  readonly selectIndex: number;
  readonly howtoPage: number;

  readonly unlockedCount: number;
  readonly campaignSolved: readonly number[];
  readonly extrasSolved: readonly number[];
  readonly campaignRecords: readonly (Metrics | null)[];
  readonly extrasRecords: readonly (Metrics | null)[];
  readonly campaignMachines: readonly (readonly PartState[] | null)[];
  readonly extrasMachines: readonly (readonly PartState[] | null)[];
  readonly campaignLast: number;
  readonly extrasLast: number;

  readonly challenge: Challenge | null;
  readonly challengeRef: { readonly mode: Mode; readonly index: number } | null;
  readonly editor: EditorState;
  readonly sim: SimState | null;

  readonly pointer: PointerState;
  readonly completion: boolean;
  readonly simTime: number;
  readonly muted: boolean;
}

import extrasRaw from "./extras.json";
import { ParticleCanvasPlayer } from "@clockwyrks/particle-runtime/canvas";
import type { ParticleSystem } from "@clockwyrks/particle-runtime";

export const BACKGROUND = "#07101c";
const gold = "#d9b875",
  pale = "#e8e3d0",
  teal = "#75d9cf";
const arms: readonly PartKind[] = [
  "arm",
  "biarm",
  "triarm",
  "hexarm",
  "piston",
];
const rows = (p: PartState) => arms.includes(p.kind) || p.kind === "wheel";
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const mod = (n: number, m: number) => ((n % m) + m) % m;
const key = (h: Hex) => `${h.q},${h.r}`;
const same = (a: Hex, b: Hex) => a.q === b.q && a.r === b.r;
const valid = (h: Hex) =>
  Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(h.q + h.r)) <= C.FIELD_R;
const xy = (h: Hex) => ({
  x: C.FIELD_CX + C.HEX_PITCH * (h.q + h.r / 2),
  y: C.FIELD_CY + ((C.HEX_PITCH * Math.sqrt(3)) / 2) * h.r,
});
const add = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r });
const rotate = (h: Hex, n: number): Hex => {
  let v = h;
  for (let i = 0; i < mod(n, 6); i++) v = { q: -v.r, r: v.q + v.r };
  return v;
};
const offset = (d: number, l = 1): Hex => ({
  q: C.DIRS[mod(d, 6)][0] * l,
  r: C.DIRS[mod(d, 6)][1] * l,
});
const hexcells: Hex[] = [];
for (let r = -C.FIELD_R; r <= C.FIELD_R; r++)
  for (let q = -C.FIELD_R; q <= C.FIELD_R; q++)
    if (valid({ q, r })) hexcells.push({ q, r });
const targetHex = (x: number, y: number): Hex | null => {
  let best: Hex | null = null,
    d = Infinity;
  for (const h of hexcells) {
    const p = xy(h),
      v = (x - p.x) ** 2 + (y - p.y) ** 2;
    if (v < d) {
      best = h;
      d = v;
    }
  }
  return d <= C.HEX_HIT_R ** 2 ? best : null;
};
const normMol = (m: {
  motes: Molecule["motes"];
  filaments: Molecule["filaments"];
  repeat?: Molecule["repeat"];
}): Molecule => ({
  motes: m.motes,
  filaments: m.filaments,
  repeat: m.repeat ?? null,
});
const extras: Challenge[] = extrasRaw.map(
  (c) =>
    ({
      ...c,
      reagents: c.reagents.map((m) => normMol(m as unknown as Molecule)),
      products: c.products.map((m) => normMol(m as unknown as Molecule)),
    }) as Challenge,
);
const campaignNames = [
  "The First Orbit",
  "Brass and Balance",
  "The Gilded Measure",
  "Threefold Sky",
  "A Longer Reach",
  "The Turning Crown",
  "The Aether Loom",
  "The Grand Orrery",
];
const campaignSeedIndices = [0, 1, 2, 4, 5, 6, 7, 3];
const referenceExtras: PartKind[][] = [
  [],
  ["biarm"],
  ["triarm", "bind"],
  ["hexarm", "manifold", "triune"],
  ["piston", "track", "sunder", "wane"],
  ["wheel", "mirror", "ascend", "conjoin", "eclipse"],
  ["confluence", "dispersion", "void", "biarm", "triarm", "bind"],
  [
    "wheel",
    "piston",
    "track",
    "hexarm",
    "manifold",
    "triune",
    "sunder",
    "dispersion",
    "void",
    "biarm",
  ],
];
const opening = normMol({
  motes: [{ q: 0, r: 0, type: "comet" }],
  filaments: [],
});
const campaign: Challenge[] = campaignNames.map((name, i) => {
  const seed = extras[campaignSeedIndices[i]];
  return {
    ...seed,
    name,
    ...(i === 0 ? { reagents: [opening], products: [opening] } : {}),
    permitted: [...new Set([...seed.permitted, ...referenceExtras[i]])],
    target: C.CONSTELLATION_TARGET,
  };
});
const emptyEditor = (): EditorState => ({
  parts: [],
  nextId: 1,
  selected: null,
  focus: "field",
  cursor: null,
  drag: null,
  undo: [],
  redo: [],
});
const fresh = (): OrreryState => ({
  screen: "title",
  mode: "campaign",
  menuIndex: 0,
  titleIndex: 0,
  selectIndex: 0,
  howtoPage: 0,
  unlockedCount: 1,
  campaignSolved: [],
  extrasSolved: [],
  campaignRecords: campaign.map(() => null),
  extrasRecords: extras.map(() => null),
  campaignMachines: campaign.map(() => null),
  extrasMachines: extras.map(() => null),
  campaignLast: 0,
  extrasLast: 0,
  challenge: null,
  challengeRef: null,
  editor: emptyEditor(),
  sim: null,
  pointer: { x: 0, y: 0, down: false },
  completion: true,
  simTime: 0,
  muted: false,
});
const course = (m: Mode) => (m === "campaign" ? campaign : extras);
const tray = (c: Challenge) =>
  [
    ...C.PARTS.filter(
      (p) => c.permitted.includes(p) && p !== "rise" && p !== "set",
    ),
    ...c.reagents.map((_, index) => ({ kind: "rise" as PartKind, index })),
    ...c.products.map((_, index) => ({ kind: "set" as PartKind, index })),
  ].map((v) =>
    typeof v === "string" ? { kind: v as PartKind, index: null } : v,
  );
const period = (parts: readonly PartState[]) =>
  Math.max(1, ...parts.map((p) => p.tape?.length ?? 0));
const cost = (parts: readonly PartState[]) =>
  parts.reduce(
    (n, p) =>
      n +
      C.PART_COSTS[p.kind] * (p.kind === "track" ? (p.cells?.length ?? 1) : 1),
    0,
  );
const spokeDirs = (p: PartState, rotation = p.rotation) => {
  const d = [rotation];
  if (p.kind === "biarm") d.push(rotation + 3);
  if (p.kind === "triarm") d.push(rotation + 2, rotation + 4);
  if (p.kind === "hexarm")
    d.push(
      rotation + 1,
      rotation + 2,
      rotation + 3,
      rotation + 4,
      rotation + 5,
    );
  return d.map((v) => mod(v, 6));
};
const isSigil = (kind: PartKind) =>
  !arms.includes(kind) && kind !== "wheel" && kind !== "track";
const footprint = (p: PartState, c: Challenge | null): Hex[] => {
  if (p.kind === "track") return [...(p.cells ?? [])];
  let offsets: Hex[] = [{ q: 0, r: 0 }];
  if (p.kind === "rise" || p.kind === "set") {
    const m =
      p.kind === "rise" ? c?.reagents[p.index ?? 0] : c?.products[p.index ?? 0];
    offsets = m?.motes.map(({ q, r }) => ({ q, r })) ?? offsets;
    if (p.kind === "set" && m?.repeat)
      offsets = [...offsets, ...m.motes.map((v) => add(v, m.repeat!.vector))];
  } else if (["bind", "triune", "sunder", "mirror", "ascend"].includes(p.kind))
    offsets.push({ q: 1, r: 0 });
  else if (p.kind === "manifold")
    offsets.push({ q: 1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: -1 });
  else if (p.kind === "conjoin") offsets.push({ q: 1, r: 0 }, { q: 0, r: 1 });
  else if (p.kind === "eclipse")
    offsets.push({ q: 1, r: 0 }, { q: 0, r: 1 }, { q: 1, r: -1 });
  else if (p.kind === "confluence" || p.kind === "dispersion")
    offsets.push(
      { q: 1, r: 0 },
      { q: 0, r: 1 },
      { q: -1, r: 0 },
      { q: 0, r: -1 },
    );
  else if (p.kind === "void")
    offsets.push(...C.DIRS.map(([q, r]) => ({ q, r })));
  return offsets.map((h) => add(p, rotate(h, p.rotation)));
};
const placementError = (
  parts: readonly PartState[],
  p: PartState,
  c: Challenge | null,
): string | null => {
  const cells = footprint(p, c);
  if (cells.some((h) => !valid(h))) return "rule 1: outside the field";
  for (const other of parts.filter((v) => v.id !== p.id)) {
    const overlap = cells.some((h) =>
      footprint(other, c).some((k) => same(h, k)),
    );
    if (
      overlap &&
      ((isSigil(p.kind) && isSigil(other.kind)) ||
        (p.kind === "track" &&
          (isSigil(other.kind) || other.kind === "track")) ||
        (other.kind === "track" && isSigil(p.kind)))
    )
      return "rule 2 or 3: overlapping footprints";
    if (rows(p) && rows(other) && same(p, other))
      return "rule 4: shared mechanism anchor";
    if (
      p.kind === "wheel" &&
      other.kind === "wheel" &&
      C.DIRS.some(([q, r]) =>
        C.DIRS.some(([u, v]) =>
          same(add(p, { q, r }), add(other, { q: u, r: v })),
        ),
      )
    )
      return "rule 4: wheel rings meet";
    if (
      (p.kind === "rise" || p.kind === "set") &&
      p.kind === other.kind &&
      p.index === other.index
    )
      return "rule 5: aperture already placed";
  }
  if (p.kind === "track") {
    const path = p.cells ?? [];
    if (new Set(path.map(key)).size !== path.length)
      return "rule 3: track repeats a cell";
    if (
      path.some(
        (h, i) =>
          i > 0 &&
          !C.DIRS.some(([q, r]) => same(add(path[i - 1], { q, r }), h)),
      )
    )
      return "rule 6: track cells are not adjacent";
    if (
      p.closed &&
      (path.length < 3 ||
        !C.DIRS.some(([q, r]) =>
          same(add(path[0], { q, r }), path[path.length - 1]),
        ))
    )
      return "rule 6: track cannot close";
  }
  return null;
};
const partAt = (s: OrreryState, h: Hex) =>
  s.editor.parts.find((p) => rows(p) && same(p, h)) ??
  s.editor.parts.find(
    (p) => p.kind === "track" && p.cells?.some((c) => same(c, h)),
  ) ??
  s.editor.parts.find(
    (p) => isSigil(p.kind) && footprint(p, s.challenge).some((c) => same(c, h)),
  );
const usePart = (s: OrreryState, p: PartState): OrreryState => {
  if (
    !C.PARTS.includes(p.kind) ||
    !Number.isInteger(p.rotation) ||
    p.rotation < 0 ||
    p.rotation > 5
  )
    throw Error("invalid part kind or rotation");
  if (
    !Number.isInteger(p.length) ||
    p.length < 1 ||
    p.length > 3 ||
    (!arms.includes(p.kind) && p.length !== 1)
  )
    throw Error("invalid part length");
  if (
    (p.kind === "rise" || p.kind === "set") &&
    (!Number.isInteger(p.index) ||
      p.index! < 0 ||
      p.index! >=
        (p.kind === "rise"
          ? (s.challenge?.reagents.length ?? 0)
          : (s.challenge?.products.length ?? 0)))
  )
    throw Error("invalid aperture index");
  const error = placementError(s.editor.parts, p, s.challenge);
  if (error) throw Error(error);
  let sim = s.sim;
  if (sim && rows(p)) {
    sim = {
      ...sim,
      poses: [
        ...sim.poses,
        {
          part: p.id,
          rotation: p.rotation,
          length: p.length,
          cell: { q: p.q, r: p.r },
        },
      ],
    };
    if (p.kind === "wheel")
      for (let d = 0; d < 6; d++)
        sim = spawn(
          sim,
          add(p, offset(d)),
          C.WHEEL_MOTES[mod(d - p.rotation, 6)],
          p.id,
        );
  }
  return {
    ...s,
    sim,
    editor: {
      ...s.editor,
      parts: [...s.editor.parts, p],
      nextId: Math.max(s.editor.nextId, p.id + 1),
    },
  };
};
const open = (s: OrreryState, m: Mode, i: number): OrreryState => {
  const c = course(m)[i];
  if (!c) throw Error("challenge index outside course");
  const stash = (m === "campaign" ? s.campaignMachines : s.extrasMachines)[i];
  return {
    ...s,
    screen: "editor",
    mode: m,
    challenge: c,
    challengeRef: { mode: m, index: i },
    editor: {
      ...emptyEditor(),
      parts: stash ?? [],
      nextId: Math.max(1, ...(stash ?? []).map((p) => p.id + 1)),
    },
    sim: null,
    ...(m === "campaign" ? { campaignLast: i } : { extrasLast: i }),
  };
};
const close = (s: OrreryState, screen: Screen): OrreryState => {
  let v = { ...s };
  if (s.challengeRef) {
    const { mode, index } = s.challengeRef;
    const arr = [
      ...(mode === "campaign" ? s.campaignMachines : s.extrasMachines),
    ];
    arr[index] = s.editor.parts;
    v =
      mode === "campaign"
        ? { ...v, campaignMachines: arr }
        : { ...v, extrasMachines: arr };
  }
  return {
    ...v,
    screen,
    challenge: null,
    challengeRef: null,
    editor: emptyEditor(),
    sim: null,
    menuIndex: s.titleIndex,
    selectIndex: s.mode === "campaign" ? s.campaignLast : s.extrasLast,
  };
};
const newPart = (
  s: OrreryState,
  kind: PartKind,
  h: Hex,
  rotation = 0,
  index: number | null = null,
): PartState => ({
  id: s.editor.nextId,
  kind,
  q: h.q,
  r: h.r,
  rotation,
  length: 1,
  cells: kind === "track" ? [h] : null,
  closed: kind === "track" ? false : null,
  index,
  tape: arms.includes(kind) || kind === "wheel" ? [] : null,
});
const edit = (
  s: OrreryState,
  parts: readonly PartState[],
  selected = s.editor.selected,
): OrreryState => ({
  ...s,
  editor: {
    ...s.editor,
    parts,
    selected,
    undo: [...s.editor.undo, s.editor.parts],
    redo: [],
    nextId: Math.max(s.editor.nextId, ...parts.map((p) => p.id + 1)),
  },
});
const updatePart = (
  s: OrreryState,
  id: number,
  fn: (p: PartState) => PartState,
): OrreryState => {
  const current = s.editor.parts.find((p) => p.id === id);
  if (!current) throw Error("unknown part");
  const next = fn(current);
  if (
    !Number.isInteger(next.rotation) ||
    next.rotation < 0 ||
    next.rotation > 5
  )
    throw Error("invalid rotation");
  if (
    !Number.isInteger(next.length) ||
    next.length < 1 ||
    next.length > 3 ||
    (!arms.includes(next.kind) && next.length !== 1)
  )
    throw Error(`invalid length for ${next.kind}`);
  const error = placementError(s.editor.parts, next, s.challenge);
  if (error) throw Error(error);
  return {
    ...s,
    editor: {
      ...s.editor,
      parts: s.editor.parts.map((p) => (p.id === id ? next : p)),
    },
  };
};
const start = (s: OrreryState): OrreryState => {
  if (!s.challenge) throw Error("no challenge");
  const poses = s.editor.parts
    .filter((p) => rows(p))
    .map((p) => ({
      part: p.id,
      rotation: p.rotation,
      length: p.length,
      cell: { q: p.q, r: p.r },
    }));
  const sim: SimState = {
    status: "running",
    cycle: 0,
    fraction: 0,
    speed: C.DEFAULT_SPEED_INDEX,
    motes: [],
    nextMoteId: 1,
    filaments: [],
    poses,
    grips: [],
    tallies: s.challenge.products.map(() => 0),
    areaHexes: s.editor.parts.flatMap((p) => [
      ...footprint(p, s.challenge),
      ...(arms.includes(p.kind)
        ? spokeDirs(p).map((d) => add(p, offset(d, p.length)))
        : p.kind === "wheel"
          ? C.DIRS.map(([q, r]) => add(p, { q, r }))
          : []),
    ]),
    fault: null,
    metrics: null,
  };
  let placed = sim;
  for (const part of s.editor.parts.filter((p) => p.kind === "wheel")) {
    for (let d = 0; d < 6; d++) {
      const type = C.WHEEL_MOTES[mod(d - part.rotation, 6)];
      placed = spawn(placed, add(part, offset(d)), type, part.id);
    }
  }
  return boundary({ ...s, sim: placed }, true);
};
const spawn = (
  sim: SimState,
  h: Hex,
  type: MoteType,
  wheel: number | null = null,
): SimState => ({
  ...sim,
  motes: [...sim.motes, { id: sim.nextMoteId, q: h.q, r: h.r, type, wheel }],
  nextMoteId: sim.nextMoteId + 1,
});
const component = (sim: SimState, id: number): Set<number> => {
  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of sim.filaments) {
      if (ids.has(f.a) && !ids.has(f.b)) {
        ids.add(f.b);
        changed = true;
      }
      if (ids.has(f.b) && !ids.has(f.a)) {
        ids.add(f.a);
        changed = true;
      }
    }
  }
  return ids;
};
const holdingGrip = (sim: SimState, mote: number) =>
  sim.grips.find((g) => component(sim, g.mote).has(mote));
const sigilPhase = (input: SimState, parts: readonly PartState[]): SimState => {
  let sim = input;
  const ordered = [...parts]
    .filter(
      (p) => C.SIGIL_GLYPH_PATHS[p.kind as keyof typeof C.SIGIL_GLYPH_PATHS],
    )
    .sort((a, b) => a.r - b.r || a.q - b.q);
  const waves: PartKind[][] = [
    [
      "wane",
      "mirror",
      "ascend",
      "conjoin",
      "eclipse",
      "confluence",
      "dispersion",
    ],
    ["bind", "manifold", "triune"],
    ["sunder"],
    ["void"],
  ];
  for (const wave of waves)
    for (const p of ordered.filter((p) => wave.includes(p.kind))) {
      const kind = p.kind;
      const cell = (q: number, r: number) =>
        add(p, rotate({ q, r }, p.rotation));
      const at = (q: number, r: number) =>
        sim.motes.find(
          (m) =>
            same(m, cell(q, r)) &&
            (m.wheel === null || (kind === "mirror" && q === 0 && r === 0)),
        );
      const a = at(0, 0),
        b = at(1, 0);
      const clear = (m: MoteState | undefined) =>
        !!m &&
        m.wheel === null &&
        !sim.filaments.some((f) => f.a === m.id || f.b === m.id) &&
        !sim.grips.some((g) => component(sim, m.id).has(g.mote));
      const free = (h: Hex) => !sim.motes.some((m) => same(m, h));
      const remove = (ids: number[]) => {
        sim = {
          ...sim,
          motes: sim.motes.filter((m) => !ids.includes(m.id)),
          filaments: sim.filaments.filter(
            (f) => !ids.includes(f.a) && !ids.includes(f.b),
          ),
          grips: sim.grips.filter((g) => !ids.includes(g.mote)),
        };
      };
      const change = (id: number, type: MoteType) => {
        sim = {
          ...sim,
          motes: sim.motes.map((m) => (m.id === id ? { ...m, type } : m)),
        };
      };
      if (
        kind === "wane" &&
        a &&
        C.ESSENCES.includes(a.type as (typeof C.ESSENCES)[number])
      )
        change(a.id, "dust");
      if (
        kind === "mirror" &&
        a &&
        b &&
        C.ESSENCES.includes(a.type as (typeof C.ESSENCES)[number]) &&
        b.type === "dust"
      )
        change(b.id, a.type);
      if (kind === "ascend" && clear(a) && b) {
        const ix = C.PLANETS.indexOf(b.type as (typeof C.PLANETS)[number]);
        if (ix >= 0 && ix < C.PLANETS.length - 1) {
          remove([a!.id]);
          change(b.id, C.PLANETS[ix + 1]);
        }
      }
      if (kind === "conjoin" && clear(a) && clear(b) && a?.type === b?.type) {
        const ix = C.PLANETS.indexOf(a!.type as (typeof C.PLANETS)[number]),
          h = cell(0, 1);
        if (ix >= 0 && ix < C.PLANETS.length - 1 && free(h)) {
          remove([a!.id, b!.id]);
          sim = spawn(sim, h, C.PLANETS[ix + 1]);
        }
      }
      if (
        kind === "eclipse" &&
        clear(a) &&
        clear(b) &&
        a?.type === "dust" &&
        b?.type === "dust" &&
        free(cell(0, 1)) &&
        free(cell(1, -1))
      ) {
        remove([a.id, b.id]);
        sim = spawn(spawn(sim, cell(0, 1), "umbra"), cell(1, -1), "lumen");
      }
      if (kind === "confluence") {
        const src = [
          [1, 0],
          [0, 1],
          [-1, 0],
          [0, -1],
        ].map(([q, r]) => at(q, r));
        if (
          src.every(clear) &&
          new Set(src.map((m) => m!.type)).size === 4 &&
          src.every((m) =>
            C.ESSENCES.includes(m!.type as (typeof C.ESSENCES)[number]),
          ) &&
          free(cell(0, 0))
        ) {
          remove(src.map((m) => m!.id));
          sim = spawn(sim, cell(0, 0), "aether");
        }
      }
      if (
        kind === "dispersion" &&
        clear(a) &&
        a?.type === "aether" &&
        [
          [1, 0],
          [0, 1],
          [-1, 0],
          [0, -1],
        ].every(([q, r]) => free(cell(q, r)))
      ) {
        remove([a.id]);
        [
          [1, 0],
          [0, 1],
          [-1, 0],
          [0, -1],
        ].forEach(([q, r], i) => {
          sim = spawn(sim, cell(q, r), C.ESSENCES[i]);
        });
      }
      const bind = (
        x: MoteState | undefined,
        y: MoteState | undefined,
        weight: number,
      ) => {
        if (
          x &&
          y &&
          !sim.filaments.some(
            (f) =>
              (f.a === x.id && f.b === y.id) || (f.a === y.id && f.b === x.id),
          )
        )
          sim = {
            ...sim,
            filaments: [...sim.filaments, { a: x.id, b: y.id, weight }],
          };
      };
      if (kind === "bind") bind(a, b, 1);
      if (kind === "manifold")
        for (const [q, r] of [
          [1, 0],
          [-1, 1],
          [0, -1],
        ])
          bind(a, at(q, r), 1);
      if (kind === "triune" && a?.type === "nova" && b?.type === "nova")
        bind(a, b, 3);
      if (kind === "sunder" && a && b)
        sim = {
          ...sim,
          filaments: sim.filaments.filter(
            (f) =>
              !(
                (f.a === a.id && f.b === b.id) ||
                (f.a === b.id && f.b === a.id)
              ),
          ),
        };
      if (kind === "void" && clear(a)) remove([a!.id]);
    }
  return sim;
};
const boundary = (s: OrreryState, settle = false): OrreryState => {
  if (!s.sim || !s.challenge) return s;
  let sim = s.sim;
  const parts = s.editor.parts;
  sim = sigilPhase(sim, parts);
  for (const p of parts.filter((v) => v.kind === "set")) {
    const pattern = s.challenge.products[p.index ?? 0];
    if (!pattern) continue;
    const origin = { q: p.q, r: p.r },
      maxCopies = pattern.repeat
        ? Math.floor(sim.motes.length / pattern.motes.length)
        : 1;
    for (
      let copies = maxCopies;
      copies >= (pattern.repeat ? C.REPEAT_MIN : 1);
      copies--
    ) {
      const vector = pattern.repeat?.vector ?? { q: 0, r: 0 };
      const coordinates = Array.from({ length: copies }, (_, i) =>
        pattern.motes.map((m) =>
          add(
            origin,
            rotate(add(m, { q: vector.q * i, r: vector.r * i }), p.rotation),
          ),
        ),
      );
      const ids = coordinates.map((cells) =>
        cells.map(
          (h, j) =>
            sim.motes.find(
              (m) =>
                same(m, h) &&
                m.type === pattern.motes[j].type &&
                m.wheel === null,
            )?.id,
        ),
      );
      if (ids.flat().some((id) => id === undefined)) continue;
      const selected = ids.flat() as number[];
      if (sim.grips.some((g) => component(sim, g.mote).has(selected[0])))
        continue;
      if (component(sim, selected[0]).size !== selected.length) continue;
      const edges: { a: number; b: number; weight: number }[] = [];
      for (let i = 0; i < copies; i++)
        for (const f of pattern.filaments) {
          const ai = pattern.motes.findIndex((m) => same(m, f.a)),
            bi = pattern.motes.findIndex((m) => same(m, f.b));
          edges.push({ a: ids[i][ai]!, b: ids[i][bi]!, weight: f.weight });
        }
      if (pattern.repeat)
        for (let i = 0; i < copies - 1; i++) {
          const a = add(
              origin,
              rotate(
                add(pattern.repeat.link.a, {
                  q: vector.q * i,
                  r: vector.r * i,
                }),
                p.rotation,
              ),
            ),
            b = add(
              origin,
              rotate(
                add(pattern.repeat.link.b, {
                  q: vector.q * i,
                  r: vector.r * i,
                }),
                p.rotation,
              ),
            );
          const ia = sim.motes.find((m) => same(m, a))?.id,
            ib = sim.motes.find((m) => same(m, b))?.id;
          if (ia === undefined || ib === undefined) break;
          edges.push({ a: ia, b: ib, weight: pattern.repeat.link.weight });
        }
      const actual = sim.filaments.filter(
        (f) => selected.includes(f.a) || selected.includes(f.b),
      );
      if (
        actual.length !== edges.length ||
        !edges.every((e) =>
          actual.some(
            (f) =>
              f.weight === e.weight &&
              ((f.a === e.a && f.b === e.b) || (f.a === e.b && f.b === e.a)),
          ),
        )
      )
        continue;
      sim = {
        ...sim,
        motes: sim.motes.filter((m) => !selected.includes(m.id)),
        filaments: sim.filaments.filter(
          (f) => !selected.includes(f.a) && !selected.includes(f.b),
        ),
        grips: sim.grips.filter((g) => !selected.includes(g.mote)),
        tallies: sim.tallies.map((v, i) => (i === p.index ? v + copies : v)),
      };
      break;
    }
  }
  for (const p of parts.filter((v) => v.kind === "rise")) {
    const pattern = s.challenge.reagents[p.index ?? 0];
    if (!pattern) continue;
    const origin = { q: p.q, r: p.r };
    if (
      pattern.motes.every(
        (m) =>
          !sim.motes.some((v) => same(v, add(origin, rotate(m, p.rotation)))),
      )
    ) {
      const ids: number[] = [];
      for (const m of pattern.motes) {
        ids.push(sim.nextMoteId);
        sim = spawn(sim, add(origin, rotate(m, p.rotation)), m.type);
      }
      for (const f of pattern.filaments) {
        const a = pattern.motes.findIndex((m) => same(m, f.a)),
          b = pattern.motes.findIndex((m) => same(m, f.b));
        sim = {
          ...sim,
          filaments: [
            ...sim.filaments,
            { a: ids[a], b: ids[b], weight: f.weight },
          ],
        };
      }
    }
  }
  const seen = new Set(sim.areaHexes.map(key));
  for (const m of sim.motes) seen.add(key(m));
  for (const part of parts.filter((p) => arms.includes(p.kind))) {
    const pose = sim.poses.find((v) => v.part === part.id);
    if (pose)
      for (const d of spokeDirs(part, pose.rotation))
        seen.add(key(add(pose.cell, offset(d, pose.length))));
  }
  sim = {
    ...sim,
    areaHexes: [...seen].map((k) => {
      const [q, r] = k.split(",").map(Number);
      return { q, r };
    }),
  };
  if (
    !settle &&
    s.completion &&
    parts.some((p) => p.kind === "set") &&
    sim.tallies.every((v) => v >= s.challenge!.target)
  ) {
    const metrics = {
      cost: cost(parts),
      cycles: sim.cycle + 1,
      area: sim.areaHexes.length,
    };
    sim = { ...sim, status: "complete", metrics };
    let v: OrreryState = { ...s, sim, menuIndex: 0 };
    if (s.challengeRef) {
      const { mode, index } = s.challengeRef,
        field = mode === "campaign" ? "campaignSolved" : "extrasSolved",
        rec = mode === "campaign" ? "campaignRecords" : "extrasRecords";
      const old = s[rec][index];
      const records = [...s[rec]];
      records[index] = old
        ? {
            cost: Math.min(old.cost, metrics.cost),
            cycles: Math.min(old.cycles, metrics.cycles),
            area: Math.min(old.area, metrics.area),
          }
        : metrics;
      v = {
        ...v,
        [field]: [...new Set([...s[field], index])].sort((a, b) => a - b),
        [rec]: records,
        unlockedCount:
          mode === "campaign"
            ? Math.min(campaign.length, Math.max(s.unlockedCount, index + 2))
            : s.unlockedCount,
      } as OrreryState;
    }
    return v;
  }
  return { ...s, sim };
};
const trackTarget = (
  pose: Pose,
  parts: readonly PartState[],
  instruction: Instruction,
): Hex | null => {
  const track = parts.find(
    (p) => p.kind === "track" && p.cells?.some((h) => same(h, pose.cell)),
  );
  if (!track?.cells) return null;
  const index = track.cells.findIndex((h) => same(h, pose.cell)),
    step = instruction === "advance" ? 1 : -1,
    next = index + step;
  if (next < 0 || next >= track.cells.length)
    return track.closed ? track.cells[mod(next, track.cells.length)] : null;
  return track.cells[next];
};
const oneCycle = (s: OrreryState): OrreryState => {
  if (!s.sim) return s;
  let sim = s.sim;
  const parts = s.editor.parts,
    P = period(parts);
  const motions = parts
    .filter(rows)
    .map((p) => ({ p, ins: p.tape?.[sim.cycle % P] ?? null }));
  for (const { p, ins } of motions) {
    let fault: FaultKind | null = null;
    if (p.kind === "wheel" && ins && !ins.startsWith("rotate"))
      fault = "impossible";
    else if ((ins === "extend" || ins === "retract") && p.kind !== "piston")
      fault = "impossible";
    else if (
      ins === "extend" &&
      (sim.poses.find((v) => v.part === p.id)?.length ?? p.length) >= 3
    )
      fault = "overextended";
    else if (
      ins === "retract" &&
      (sim.poses.find((v) => v.part === p.id)?.length ?? p.length) <= 1
    )
      fault = "overretracted";
    if (ins === "advance" || ins === "recede") {
      const pose = sim.poses.find((v) => v.part === p.id);
      const mounted = parts.some(
        (v) =>
          v.kind === "track" &&
          v.cells?.some((h) => pose && same(h, pose.cell)),
      );
      if (!mounted) fault = "unmounted";
      else if (pose && !trackTarget(pose, parts, ins)) fault = "track-end";
    }
    if (fault)
      return {
        ...s,
        sim: {
          ...sim,
          status: "faulted",
          fault: { kind: fault, parts: [p.id], motes: [] },
          fraction: 0,
        },
      };
  }
  const checked = new Set<number>();
  for (const m of sim.motes) {
    if (checked.has(m.id)) continue;
    const ids = component(sim, m.id);
    for (const id of ids) checked.add(id);
    const grips = sim.grips.filter((g) => ids.has(g.mote));
    if (grips.length < 2) continue;
    const movements = grips.map((g) => {
      const pose = sim.poses.find((p) => p.part === g.part),
        command = motions.find((v) => v.p.id === g.part)?.ins;
      if (!pose || !command || command === "grab" || command === "drop")
        return "still";
      if (command === "rotate-cw" || command === "rotate-ccw")
        return `rotate:${pose.cell.q},${pose.cell.r}:${command}`;
      if (command === "pivot-cw" || command === "pivot-ccw") {
        const center = add(pose.cell, offset(g.spoke, pose.length));
        return `rotate:${center.q},${center.r}:${command}`;
      }
      if (command === "extend" || command === "retract") {
        const d = offset(pose.rotation, command === "extend" ? 1 : -1);
        return `translate:${d.q},${d.r}`;
      }
      if (command === "advance" || command === "recede") {
        const next = trackTarget(pose, parts, command);
        return next
          ? `translate:${next.q - pose.cell.q},${next.r - pose.cell.r}`
          : "still";
      }
      return "still";
    });
    if (new Set(movements).size > 1)
      return {
        ...s,
        sim: {
          ...sim,
          status: "faulted",
          fraction: 0,
          fault: {
            kind: "torn",
            parts: parts
              .filter((p) => grips.some((g) => g.part === p.id))
              .map((p) => p.id),
            motes: [...ids].sort((a, b) => a - b),
          },
        },
      };
  }
  const motionOwner = new Map<number, number>();
  for (const mote of sim.motes) {
    const grip = holdingGrip(sim, mote.id);
    if (grip) motionOwner.set(mote.id, grip.part);
    else if (mote.wheel !== null) motionOwner.set(mote.id, mote.wheel);
  }
  for (let k = 1; k <= C.COLLISION_SAMPLES; k++) {
    const t = k / C.COLLISION_SAMPLES;
    const position = (m: MoteState) => {
      const origin = xy(m);
      const grip = holdingGrip(sim, m.id);
      const carrier = grip?.part ?? m.wheel;
      if (carrier === null || carrier === undefined) return origin;
      const command = motions.find((v) => v.p.id === carrier)?.ins;
      const pose = sim.poses.find((v) => v.part === carrier);
      if (!pose) return origin;
      if (command === "rotate-cw" || command === "rotate-ccw") {
        const c = xy(pose.cell),
          a = ((command === "rotate-cw" ? 1 : -1) * t * Math.PI) / 3,
          dx = origin.x - c.x,
          dy = origin.y - c.y;
        return {
          x: c.x + dx * Math.cos(a) - dy * Math.sin(a),
          y: c.y + dx * Math.sin(a) + dy * Math.cos(a),
        };
      }
      if (command === "pivot-cw" || command === "pivot-ccw") {
        const center = xy(add(pose.cell, offset(grip!.spoke, pose.length))),
          a = ((command === "pivot-cw" ? 1 : -1) * t * Math.PI) / 3,
          dx = origin.x - center.x,
          dy = origin.y - center.y;
        return {
          x: center.x + dx * Math.cos(a) - dy * Math.sin(a),
          y: center.y + dx * Math.sin(a) + dy * Math.cos(a),
        };
      }
      if (command === "extend" || command === "retract") {
        const d = offset(pose.rotation),
          a = xy(d),
          o = xy({ q: 0, r: 0 }),
          sign = command === "extend" ? 1 : -1;
        return {
          x: origin.x + sign * (a.x - o.x) * t,
          y: origin.y + sign * (a.y - o.y) * t,
        };
      }
      if (command === "advance" || command === "recede") {
        const target = trackTarget(pose, parts, command);
        if (target) {
          const end = xy(target),
            begin = xy(pose.cell);
          return {
            x: origin.x + (end.x - begin.x) * t,
            y: origin.y + (end.y - begin.y) * t,
          };
        }
      }
      return origin;
    };
    const hits = new Set<number>();
    for (let i = 0; i < sim.motes.length; i++)
      for (let j = i + 1; j < sim.motes.length; j++) {
        const a = position(sim.motes[i]),
          b = position(sim.motes[j]);
        if ((a.x - b.x) ** 2 + (a.y - b.y) ** 2 < (2 * C.MOTE_COLLIDE_R) ** 2) {
          hits.add(sim.motes[i].id);
          hits.add(sim.motes[j].id);
        }
      }
    if (hits.size)
      return {
        ...s,
        sim: {
          ...sim,
          status: "faulted",
          fraction: t,
          fault: {
            kind: "collision",
            parts: [],
            motes: [...hits].sort((a, b) => a - b),
          },
        },
      };
  }
  const pivoted = new Set<number>();
  for (const { p, ins } of motions) {
    const pose = sim.poses.find((v) => v.part === p.id);
    if (!pose) continue;
    let next = { ...pose };
    if (ins === "rotate-cw")
      next = { ...next, rotation: mod(next.rotation + 1, 6) };
    if (ins === "rotate-ccw")
      next = { ...next, rotation: mod(next.rotation - 1, 6) };
    if (ins === "extend") next = { ...next, length: next.length + 1 };
    if (ins === "retract") next = { ...next, length: next.length - 1 };
    if (ins === "drop")
      sim = { ...sim, grips: sim.grips.filter((g) => g.part !== p.id) };
    if (ins === "grab") {
      for (const d of spokeDirs(p, pose.rotation)) {
        const h = add(pose.cell, offset(d, pose.length)),
          m = sim.motes.find((v) => same(v, h) && v.wheel === null);
        if (m && !sim.grips.some((g) => g.part === p.id && g.spoke === d))
          sim = {
            ...sim,
            grips: [...sim.grips, { part: p.id, spoke: d, mote: m.id }],
          };
      }
    }
    if (ins === "rotate-cw" || ins === "rotate-ccw") {
      const n = ins === "rotate-cw" ? 1 : -1;
      sim = {
        ...sim,
        motes: sim.motes.map((m) =>
          motionOwner.get(m.id) === p.id
            ? {
                ...m,
                ...add(
                  pose.cell,
                  rotate({ q: m.q - pose.cell.q, r: m.r - pose.cell.r }, n),
                ),
              }
            : m,
        ),
        grips: sim.grips.map((g) =>
          g.part === p.id ? { ...g, spoke: mod(g.spoke + n, 6) } : g,
        ),
      };
    }
    if (ins === "pivot-cw" || ins === "pivot-ccw") {
      const step = ins === "pivot-cw" ? 1 : -1;
      for (const grip of sim.grips.filter((g) => g.part === p.id)) {
        const ids = component(sim, grip.mote);
        if ([...ids].some((id) => pivoted.has(id))) continue;
        for (const id of ids) pivoted.add(id);
        const center = add(pose.cell, offset(grip.spoke, pose.length));
        sim = {
          ...sim,
          motes: sim.motes.map((m) =>
            ids.has(m.id)
              ? {
                  ...m,
                  ...add(
                    center,
                    rotate({ q: m.q - center.q, r: m.r - center.r }, step),
                  ),
                }
              : m,
          ),
        };
      }
    }
    if (ins === "extend" || ins === "retract") {
      const d = offset(pose.rotation, ins === "extend" ? 1 : -1);
      sim = {
        ...sim,
        motes: sim.motes.map((m) =>
          motionOwner.get(m.id) === p.id
            ? { ...m, q: m.q + d.q, r: m.r + d.r }
            : m,
        ),
      };
    }
    if (ins === "advance" || ins === "recede") {
      const target = trackTarget(pose, parts, ins)!;
      const delta = { q: target.q - pose.cell.q, r: target.r - pose.cell.r };
      next = { ...next, cell: target };
      sim = {
        ...sim,
        motes: sim.motes.map((m) =>
          motionOwner.get(m.id) === p.id
            ? { ...m, q: m.q + delta.q, r: m.r + delta.r }
            : m,
        ),
      };
    }
    sim = { ...sim, poses: sim.poses.map((v) => (v.part === p.id ? next : v)) };
  }
  const hits = new Set<number>();
  for (let i = 0; i < sim.motes.length; i++)
    for (let j = i + 1; j < sim.motes.length; j++) {
      const a = xy(sim.motes[i]),
        b = xy(sim.motes[j]);
      if ((a.x - b.x) ** 2 + (a.y - b.y) ** 2 < (2 * C.MOTE_COLLIDE_R) ** 2) {
        hits.add(sim.motes[i].id);
        hits.add(sim.motes[j].id);
      }
    }
  if (hits.size)
    return {
      ...s,
      sim: {
        ...sim,
        status: "faulted",
        fault: {
          kind: "collision",
          parts: [],
          motes: [...hits].sort((a, b) => a - b),
        },
        fraction: 1,
      },
    };
  const ended = boundary({ ...s, sim: { ...sim, fraction: 0 } });
  return ended.sim?.status === "running"
    ? { ...ended, sim: { ...ended.sim, cycle: sim.cycle + 1 } }
    : ended;
};
const menuCount = (s: OrreryState) =>
  s.screen === "title"
    ? 3
    : s.screen === "howto"
      ? 1
      : s.screen === "select"
        ? course(s.mode).length
        : s.sim?.status === "complete"
          ? s.challengeRef && s.challengeRef.index < course(s.mode).length - 1
            ? 3
            : 2
          : 0;
const menuRect = (s: OrreryState, i: number) => {
  if (i < 0 || i >= menuCount(s)) return null;
  if (s.screen === "title") return { x: 450, y: 354 + i * 66, w: 380, h: 54 };
  if (s.screen === "howto") return { x: 510, y: 612, w: 260, h: 48 };
  if (s.screen === "select") return { x: 268, y: 108 + i * 51, w: 744, h: 46 };
  return { x: 450, y: 382 + i * 53, w: 380, h: 45 };
};
const take = (s: OrreryState): OrreryState => {
  if (s.screen === "title") {
    if (s.menuIndex === 2)
      return {
        ...s,
        screen: "howto",
        howtoPage: 0,
        titleIndex: 2,
        menuIndex: 0,
      };
    const m = s.menuIndex === 0 ? "campaign" : "extras";
    return {
      ...s,
      screen: "select",
      mode: m,
      titleIndex: s.menuIndex,
      selectIndex: m === "campaign" ? s.campaignLast : s.extrasLast,
    };
  }
  if (s.screen === "howto")
    return { ...s, screen: "title", menuIndex: s.titleIndex, howtoPage: 0 };
  if (s.screen === "select")
    return s.mode === "extras" || s.selectIndex < s.unlockedCount
      ? open(s, s.mode, s.selectIndex)
      : s;
  if (s.sim?.status === "complete") {
    const n = menuCount(s) === 3 ? s.menuIndex : s.menuIndex + 1;
    if (n === 0 && s.challengeRef)
      return open(close(s, "select"), s.mode, s.challengeRef.index + 1);
    if (n === 1) return { ...s, sim: null };
    return close(s, "select");
  }
  return s;
};
const tapeWindow = (editor: EditorState) => {
  const rowsList = editor.parts.filter(rows),
    selected = rowsList.findIndex((p) => p.id === editor.cursor?.part);
  return {
    rowsList,
    firstRow: Math.max(0, selected - (C.TAPE_ROWS_VISIBLE - 1)),
    firstCol: Math.max(
      0,
      (editor.cursor?.col ?? 0) - (C.TAPE_COLS_VISIBLE - 1),
    ),
  };
};
const pendingPointerCues = new Set<C.CueName>();
const pointerEvent = (
  s: OrreryState,
  type: "down" | "move" | "up",
  x: number,
  y: number,
): OrreryState => {
  let v = {
    ...s,
    pointer: {
      x,
      y,
      down: type === "down" ? true : type === "up" ? false : s.pointer.down,
    },
  } as OrreryState;
  if (menuCount(v)) {
    let hit = -1;
    for (let i = 0; i < menuCount(v); i++) {
      const r = menuRect(v, i)!;
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) {
        hit = i;
        break;
      }
    }
    if (hit >= 0)
      v = {
        ...v,
        ...(v.screen === "select" ? { selectIndex: hit } : { menuIndex: hit }),
      };
    if (type === "up" && hit >= 0) return take(v);
    return v;
  }
  if (v.screen !== "editor") return v;
  if (v.sim)
    return {
      ...v,
      editor: {
        ...v.editor,
        focus: x >= C.TRAY_REGION_W && y >= C.TAPE_Y0 ? "tape" : "field",
      },
    };
  const ed = v.editor,
    h = targetHex(x, y),
    drag = ed.drag;
  if (type === "down") {
    if (x < C.TRAY_REGION_W && y >= C.TRAY_Y0) {
      const i = Math.floor((y - C.TRAY_Y0) / C.TRAY_SLOT_H),
        entry = v.challenge ? tray(v.challenge)[i] : null;
      if (
        (entry && !(entry.kind === "rise" || entry.kind === "set")) ||
        (entry &&
          !ed.parts.some(
            (p) => p.kind === entry.kind && p.index === entry.index,
          ))
      )
        return {
          ...v,
          editor: {
            ...ed,
            focus: "field",
            drag: {
              kind: "place",
              part: entry.kind,
              index: entry.index,
              rotation: 0,
              length: 1,
              at: h,
              before: ed.parts,
            },
          },
        };
      return { ...v, editor: { ...ed, focus: "field" } };
    }
    if (y >= C.TAPE_Y0) {
      const window = tapeWindow(ed);
      const rr = Math.floor((y - C.TAPE_Y0) / C.TAPE_ROW_H),
        p = window.rowsList[window.firstRow + rr],
        col = Math.max(
          0,
          window.firstCol +
            Math.floor((x - (C.TRAY_REGION_W + C.TAPE_X0)) / C.TAPE_CELL_W),
        );
      return {
        ...v,
        editor: {
          ...ed,
          focus: "tape",
          cursor: p ? { part: p.id, col } : ed.cursor,
        },
      };
    }
    if (h) {
      const p = partAt(v, h);
      if (
        p?.kind === "track" &&
        !p.closed &&
        p.cells?.length &&
        (same(h, p.cells[0]) || same(h, p.cells[p.cells.length - 1]))
      ) {
        const end =
          p.cells.length === 1 || same(h, p.cells[p.cells.length - 1])
            ? "last"
            : "first";
        return {
          ...v,
          editor: {
            ...ed,
            selected: p.id,
            focus: "field",
            drag: { kind: "lay", part: p.id, end, before: ed.parts },
          },
        };
      }
      if (p)
        return {
          ...v,
          editor: {
            ...ed,
            selected: p.id,
            cursor: rows(p) ? { part: p.id, col: 0 } : ed.cursor,
            focus: "field",
            drag: {
              kind: "move",
              part: p.id,
              from: h,
              at: h,
              rotation: p.rotation,
              length: p.length,
              before: ed.parts,
            },
          },
        };
    }
    return { ...v, editor: { ...ed, focus: "field", selected: null } };
  }
  if (type === "move" && drag?.kind === "lay" && h) {
    const p = ed.parts.find((z) => z.id === drag.part);
    if (!p?.cells || p.closed) return v;
    const cells = [...p.cells],
      first = drag.end === "first",
      live = first ? cells[0] : cells[cells.length - 1],
      back = first ? cells[1] : cells[cells.length - 2],
      other = first ? cells[cells.length - 1] : cells[0];
    if (back && same(h, back)) {
      if (first) cells.shift();
      else cells.pop();
    } else if (
      cells.length >= 3 &&
      same(h, other) &&
      C.DIRS.some(([q, r]) => same(add(live, { q, r }), h))
    ) {
      const next = { ...p, closed: true };
      if (!placementError(ed.parts, next, v.challenge))
        return {
          ...v,
          editor: {
            ...ed,
            parts: ed.parts.map((z) => (z.id === p.id ? next : z)),
            drag: null,
          },
        };
      return v;
    } else if (
      C.DIRS.some(([q, r]) => same(add(live, { q, r }), h)) &&
      !cells.some((z) => same(z, h))
    ) {
      if (first) cells.unshift(h);
      else cells.push(h);
    } else return v;
    const next = { ...p, q: cells[0].q, r: cells[0].r, cells };
    if (placementError(ed.parts, next, v.challenge)) return v;
    return {
      ...v,
      editor: { ...ed, parts: ed.parts.map((z) => (z.id === p.id ? next : z)) },
    };
  }
  if (type === "move" && drag)
    return { ...v, editor: { ...ed, drag: { ...drag, at: h } } as EditorState };
  if (type === "up" && drag) {
    let parts = ed.parts;
    let selected = ed.selected;
    if (drag.kind === "lay") {
      const changed = JSON.stringify(parts) !== JSON.stringify(drag.before);
      return {
        ...v,
        editor: {
          ...ed,
          drag: null,
          undo: changed ? [...ed.undo, drag.before] : ed.undo,
          redo: changed ? [] : ed.redo,
        },
      };
    }
    if (h && drag.kind === "place") {
      const p = {
        ...newPart(v, drag.part, h, drag.rotation, drag.index),
        length: drag.length,
      };
      if (!placementError(parts, p, v.challenge)) {
        parts = [...parts, p];
        selected = p.id;
      }
    }
    if (h && drag.kind === "move") {
      const p = parts.find((z) => z.id === drag.part);
      if (p) {
        const dq = h.q - drag.from.q,
          dr = h.r - drag.from.r;
        if (
          dq ||
          dr ||
          drag.rotation !== p.rotation ||
          drag.length !== p.length
        )
          parts = parts.map((z) =>
            z.id === p.id
              ? {
                  ...z,
                  q: p.q + dq,
                  r: p.r + dr,
                  rotation: drag.rotation,
                  length: drag.length,
                  cells:
                    p.cells?.map((c) => ({ q: c.q + dq, r: c.r + dr })) ?? null,
                }
              : z,
          );
        const moved = parts.find((z) => z.id === p.id)!;
        if (placementError(parts, moved, v.challenge)) parts = ed.parts;
      }
    }
    if (parts !== ed.parts) {
      if (
        drag.kind === "place" ||
        (drag.kind === "move" &&
          parts.some(
            (p, i) => p.q !== ed.parts[i]?.q || p.r !== ed.parts[i]?.r,
          ))
      )
        pendingPointerCues.add(C.CUES.place);
      const committed = edit(v, parts, selected);
      return { ...committed, editor: { ...committed.editor, drag: null } };
    }
    return { ...v, editor: { ...ed, drag: null } };
  }
  return v;
};
const insActions: Record<string, Instruction> = {
  "ins-grab": "grab",
  "ins-drop": "drop",
  "ins-rotate-cw": "rotate-cw",
  "ins-rotate-ccw": "rotate-ccw",
  "ins-pivot-cw": "pivot-cw",
  "ins-pivot-ccw": "pivot-ccw",
  "ins-extend": "extend",
  "ins-retract": "retract",
  "ins-advance": "advance",
  "ins-recede": "recede",
};
const keyboard = (s: OrreryState, a: string): OrreryState => {
  if (a === "mute") return s;
  if (menuCount(s)) {
    if (a === "up" || a === "down") {
      const n = menuCount(s),
        d = a === "down" ? 1 : -1;
      return s.screen === "select"
        ? { ...s, selectIndex: mod(s.selectIndex + d, n) }
        : { ...s, menuIndex: mod(s.menuIndex + d, n) };
    }
    if (a === "confirm") return take(s);
    if (a === "back")
      return s.screen === "select"
        ? close(s, "title")
        : s.screen === "howto"
          ? { ...s, screen: "title", menuIndex: s.titleIndex, howtoPage: 0 }
          : s.screen === "editor" && s.sim?.status === "complete"
            ? { ...s, sim: null }
            : s;
    if (s.screen === "howto" && (a === "left" || a === "right"))
      return {
        ...s,
        howtoPage: clamp(
          s.howtoPage + (a === "right" ? 1 : -1),
          0,
          C.HOWTO_PAGES - 1,
        ),
      };
    return s;
  }
  if (s.screen !== "editor") return s;
  if (s.editor.drag) {
    const drag = s.editor.drag;
    if (drag.kind === "lay") return s;
    if (a === "part-cw" || a === "part-ccw")
      return {
        ...s,
        editor: {
          ...s.editor,
          drag: {
            ...drag,
            rotation: mod(drag.rotation + (a === "part-cw" ? 1 : -1), 6),
          },
        },
      };
    const kind =
      drag.kind === "place"
        ? drag.part
        : s.editor.parts.find((p) => p.id === drag.part)?.kind;
    if (
      (a === "part-grow" || a === "part-shrink") &&
      kind &&
      arms.includes(kind)
    )
      return {
        ...s,
        editor: {
          ...s.editor,
          drag: {
            ...drag,
            length: clamp(drag.length + (a === "part-grow" ? 1 : -1), 1, 3),
          },
        },
      };
    return s;
  }
  if (a === "back") return s.sim ? { ...s, sim: null } : close(s, "select");
  if (a === "play") {
    if (s.sim) {
      if (s.sim.status === "running" || s.sim.status === "paused")
        return {
          ...s,
          sim: {
            ...s.sim,
            status: s.sim.status === "running" ? "paused" : "running",
          },
        };
      return s;
    }
    return s.challenge &&
      s.editor.parts.filter((p) => p.kind === "rise").length ===
        s.challenge.reagents.length &&
      s.editor.parts.filter((p) => p.kind === "set").length ===
        s.challenge.products.length
      ? start(s)
      : s;
  }
  if (a === "step") {
    if (!s.sim) {
      if (
        !s.challenge ||
        s.editor.parts.filter((p) => p.kind === "rise").length !==
          s.challenge.reagents.length ||
        s.editor.parts.filter((p) => p.kind === "set").length !==
          s.challenge.products.length
      )
        return s;
      const v = start(s);
      return { ...v, sim: { ...v.sim!, status: "paused" } };
    }
    if (s.sim.status === "paused" || s.sim.status === "running") {
      const v = oneCycle(s);
      return v.sim?.status === "running"
        ? { ...v, sim: { ...v.sim, status: "paused" } }
        : v;
    }
    return s;
  }
  if (s.sim) {
    if (a === "speed-up" || a === "speed-down")
      return {
        ...s,
        sim: {
          ...s.sim,
          speed: clamp(
            s.sim.speed + (a === "speed-up" ? 1 : -1),
            0,
            C.SPEEDS.length - 1,
          ),
        },
      };
    return s;
  }
  if (a === "undo" && s.editor.undo.length) {
    const before = s.editor.undo[s.editor.undo.length - 1]!;
    return {
      ...s,
      editor: {
        ...s.editor,
        parts: before,
        selected: before.some((p) => p.id === s.editor.selected)
          ? s.editor.selected
          : null,
        cursor: before.some((p) => p.id === s.editor.cursor?.part)
          ? s.editor.cursor
          : null,
        undo: s.editor.undo.slice(0, -1),
        redo: [...s.editor.redo, s.editor.parts],
      },
    };
  }
  if (a === "redo" && s.editor.redo.length) {
    const next = s.editor.redo[s.editor.redo.length - 1]!;
    return {
      ...s,
      editor: {
        ...s.editor,
        parts: next,
        selected: next.some((p) => p.id === s.editor.selected)
          ? s.editor.selected
          : null,
        cursor: next.some((p) => p.id === s.editor.cursor?.part)
          ? s.editor.cursor
          : null,
        redo: s.editor.redo.slice(0, -1),
        undo: [...s.editor.undo, s.editor.parts],
      },
    };
  }
  if (s.editor.focus === "field") {
    const id = s.editor.selected,
      p = s.editor.parts.find((v) => v.id === id);
    if (!p) return s;
    if (a === "part-delete")
      return edit(
        s,
        s.editor.parts.filter((v) => v.id !== id),
        null,
      );
    if (
      a === "part-cw" ||
      a === "part-ccw" ||
      (arms.includes(p.kind) && (a === "part-grow" || a === "part-shrink"))
    ) {
      const next = {
        ...p,
        rotation:
          a === "part-cw" || a === "part-ccw"
            ? mod(p.rotation + (a === "part-cw" ? 1 : -1), 6)
            : p.rotation,
        length:
          a === "part-grow" || a === "part-shrink"
            ? clamp(p.length + (a === "part-grow" ? 1 : -1), 1, 3)
            : p.length,
      };
      if (
        (next.rotation === p.rotation && next.length === p.length) ||
        placementError(s.editor.parts, next, s.challenge)
      )
        return s;
      return edit(
        s,
        s.editor.parts.map((v) => (v.id === id ? next : v)),
      );
    }
    return s;
  }
  const cur = s.editor.cursor;
  if (!cur) return s;
  const ps = s.editor.parts.filter(rows),
    ri = ps.findIndex((p) => p.id === cur.part);
  if (a === "up" || a === "down")
    return {
      ...s,
      editor: {
        ...s.editor,
        cursor: {
          part: ps[mod(ri + (a === "down" ? 1 : -1), ps.length)].id,
          col: cur.col,
        },
      },
    };
  if (a === "left" || a === "right")
    return {
      ...s,
      editor: {
        ...s.editor,
        cursor: {
          ...cur,
          col: Math.max(0, cur.col + (a === "right" ? 1 : -1)),
        },
      },
    };
  const p = ps[ri];
  if (!p) return s;
  const ins = insActions[a] ?? (a === "ins-blank" ? null : undefined);
  if (ins !== undefined || a === "ins-erase") {
    if (a === "ins-erase" && cur.col === 0) return s;
    const col = a === "ins-erase" ? Math.max(0, cur.col - 1) : cur.col,
      t = [...(p.tape ?? [])];
    while (t.length <= col) t.push(null);
    t[col] = ins ?? null;
    while (t.length && t[t.length - 1] === null) t.pop();
    if (JSON.stringify(t) === JSON.stringify(p.tape ?? [])) return s;
    const v = edit(
      s,
      s.editor.parts.map((z) => (z.id === p.id ? { ...z, tape: t } : z)),
    );
    return {
      ...v,
      editor: {
        ...v.editor,
        cursor: { ...cur, col: a === "ins-erase" ? col : ins ? col + 1 : col },
      },
    };
  }
  if (a === "ins-repeat" || a === "ins-reset") {
    let expansion: TapeCell[] = [];
    if (a === "ins-repeat") expansion = (p.tape ?? []).slice(0, cur.col);
    else {
      let rotation = p.rotation,
        length = p.length,
        cell = { q: p.q, r: p.r };
      for (let i = 0; i < cur.col; i++) {
        const command = p.tape?.[i];
        if (command === "rotate-cw") rotation = mod(rotation + 1, 6);
        if (command === "rotate-ccw") rotation = mod(rotation - 1, 6);
        if (command === "extend") length = clamp(length + 1, 1, 3);
        if (command === "retract") length = clamp(length - 1, 1, 3);
        if (command === "advance" || command === "recede") {
          const target = trackTarget(
            { part: p.id, rotation, length, cell },
            s.editor.parts,
            command,
          );
          if (target) cell = target;
        }
      }
      if (p.kind !== "wheel") {
        expansion.push("drop");
        while (length > p.length) {
          expansion.push("retract");
          length--;
        }
        while (length < p.length) {
          expansion.push("extend");
          length++;
        }
      }
      const cw = mod(p.rotation - rotation, 6),
        ccw = mod(rotation - p.rotation, 6),
        turn = cw <= ccw ? "rotate-cw" : "rotate-ccw";
      for (let i = 0; i < Math.min(cw, ccw); i++) expansion.push(turn);
      if (p.kind !== "wheel") {
        const track = s.editor.parts.find(
          (z) =>
            z.kind === "track" &&
            z.cells?.some((h) => same(h, cell)) &&
            z.cells?.some((h) => same(h, p)),
        );
        if (track?.cells) {
          const at = track.cells.findIndex((h) => same(h, cell)),
            home = track.cells.findIndex((h) => same(h, p));
          let advance = mod(home - at, track.cells.length),
            recede = mod(at - home, track.cells.length);
          if (!track.closed) {
            advance = home >= at ? home - at : Infinity;
            recede = home <= at ? at - home : Infinity;
          }
          const command = advance <= recede ? "advance" : "recede";
          for (let i = 0; i < Math.min(advance, recede); i++)
            expansion.push(command);
        }
      }
    }
    if (!expansion.length) return s;
    const tape = [...(p.tape ?? [])];
    for (let i = 0; i < expansion.length; i++) {
      while (tape.length <= cur.col + i) tape.push(null);
      tape[cur.col + i] = expansion[i];
    }
    while (tape.length && tape[tape.length - 1] === null) tape.pop();
    const v = edit(
      s,
      s.editor.parts.map((z) => (z.id === p.id ? { ...z, tape } : z)),
    );
    return {
      ...v,
      editor: {
        ...v.editor,
        cursor: { ...cur, col: cur.col + expansion.length },
      },
    };
  }
  return s;
};
const images = new Map<string, ImageBitmap>();
const particleSystems = new Map<string, ParticleSystem>();
const liveEffects: {
  player: ParticleCanvasPlayer;
  x: number;
  y: number;
  time: number;
}[] = [];
let lastEffectKey = "";
let previousRenderTime = 0;
const image = (
  ctx: CanvasRenderingContext2D,
  path: string,
  x: number,
  y: number,
  w: number,
  h = w,
  angle = 0,
) => {
  const im = images.get(path);
  if (!im) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.drawImage(im, -w / 2, -h / 2, w, h);
  ctx.restore();
};
const label = (
  ctx: CanvasRenderingContext2D,
  t: string,
  x: number,
  y: number,
  size = 16,
  color = pale,
  align: CanvasTextAlign = "left",
) => {
  ctx.fillStyle = color;
  ctx.font = `${size}px Georgia`;
  ctx.textAlign = align;
  ctx.fillText(t, x, y);
};
const box = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke = "#866b45",
) => {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = stroke;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
};
const drawMenu = (
  ctx: CanvasRenderingContext2D,
  s: OrreryState,
  items: readonly string[],
) =>
  items.forEach((t, i) => {
    const r = menuRect(s, i);
    if (!r) return;
    box(
      ctx,
      r.x,
      r.y,
      r.w,
      r.h,
      (s.screen === "select" ? s.selectIndex : s.menuIndex) === i
        ? "#30444a"
        : "#101d2b",
    );
    label(
      ctx,
      t,
      r.x + 18,
      r.y + r.h / 2 + 6,
      20,
      (s.screen === "select" ? s.selectIndex : s.menuIndex) === i
        ? "#ffdc96"
        : pale,
    );
  });
const visualCommand = (s: DeepReadonly<OrreryState>, part: number) => {
  const p = s.editor.parts.find((v) => v.id === part);
  if (!p || !s.sim) return null;
  return p.tape?.[s.sim.cycle % period(s.editor.parts)] ?? null;
};
const visualMote = (s: DeepReadonly<OrreryState>, m: MoteState) => {
  const pos = xy(m),
    grip = s.sim ? holdingGrip(s.sim, m.id) : undefined;
  if (!s.sim) return pos;
  const carrier = grip?.part ?? m.wheel;
  if (carrier === null) return pos;
  const pose = s.sim.poses.find((p) => p.part === carrier);
  if (!pose) return pos;
  const ins = visualCommand(s, carrier),
    t = s.sim.fraction;
  if (ins === "rotate-cw" || ins === "rotate-ccw") {
    const center = xy(pose.cell),
      ang = ((ins === "rotate-cw" ? 1 : -1) * t * Math.PI) / 3,
      dx = pos.x - center.x,
      dy = pos.y - center.y;
    return {
      x: center.x + dx * Math.cos(ang) - dy * Math.sin(ang),
      y: center.y + dx * Math.sin(ang) + dy * Math.cos(ang),
    };
  }
  if ((ins === "pivot-cw" || ins === "pivot-ccw") && grip) {
    const center = xy(add(pose.cell, offset(grip.spoke, pose.length))),
      a = ((ins === "pivot-cw" ? 1 : -1) * t * Math.PI) / 3,
      dx = pos.x - center.x,
      dy = pos.y - center.y;
    return {
      x: center.x + dx * Math.cos(a) - dy * Math.sin(a),
      y: center.y + dx * Math.sin(a) + dy * Math.cos(a),
    };
  }
  if (ins === "extend" || ins === "retract") {
    const d = offset(pose.rotation),
      a = xy(d),
      o = xy({ q: 0, r: 0 }),
      n = (ins === "extend" ? 1 : -1) * t;
    return { x: pos.x + (a.x - o.x) * n, y: pos.y + (a.y - o.y) * n };
  }
  if (ins === "advance" || ins === "recede") {
    const target = trackTarget(pose, s.editor.parts, ins);
    if (target) {
      const end = xy(target),
        start = xy(pose.cell);
      return {
        x: pos.x + (end.x - start.x) * t,
        y: pos.y + (end.y - start.y) * t,
      };
    }
  }
  return pos;
};
const patternLabel = (m: Molecule) =>
  `${m.motes.map((v) => v.type.toUpperCase()).join(" + ")}${m.filaments.length ? ` • ${m.filaments.length} LINK${m.filaments.length === 1 ? "" : "S"}` : ""}${m.repeat ? " • REPEAT" : ""}`;
const render = (
  s: DeepReadonly<OrreryState>,
  ctx: CanvasRenderingContext2D,
) => {
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  const st = s as OrreryState;
  const grad = ctx.createRadialGradient(640, 290, 40, 640, 290, 670);
  grad.addColorStop(0, "#172c39");
  grad.addColorStop(1, BACKGROUND);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1280, 720);
  for (let i = 0; i < 70; i++) {
    const x = (i * 197 + 79) % 1280,
      y = (i * 307 + 31) % 720;
    ctx.fillStyle = i % 4 === 0 ? "#b8d7d2" : "#506978";
    ctx.fillRect(x, y, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1);
  }
  if (s.screen === "title") {
    label(ctx, C.TITLE_TEXT, 640, 222, 82, gold, "center");
    label(ctx, C.TAGLINE_TEXT, 640, 271, 20, teal, "center");
    drawMenu(ctx, st, C.TITLE_ITEMS);
    label(ctx, "A CELESTIAL MACHINE PUZZLE", 640, 665, 15, "#899ca2", "center");
    return;
  }
  if (s.screen === "howto") {
    label(ctx, "FIELD NOTES", 640, 112, 42, gold, "center");
    const pages = [
      [
        "The sky is a field of 91 hexes.",
        "Carry motes from rises to sets.",
        "Join them into the products the challenge asks for.",
      ],
      [
        "Place rises, sets, arms, tracks and engraved sigils.",
        "Grippers carry motes; sigils transform them.",
        "Turn parts with Q and E; change reach with W and S.",
      ],
      [
        "Each arm has a looping instruction tape.",
        "Click a tape cell, then use G to grab, V to drop,",
        "A and D to rotate, W and S to extend or retract.",
      ],
      [
        "Space starts or pauses. N steps one cycle.",
        "Use , and . to change speed.",
        "Collisions and impossible instructions halt the machine.",
      ],
      [
        "Deliver each product six times to finish.",
        "The game records cost, cycles, and area.",
        "Seek a smaller machine and a cleaner orbit.",
      ],
    ];
    pages[s.howtoPage].forEach((t, i) =>
      label(ctx, t, 640, 240 + i * 53, 24, pale, "center"),
    );
    label(
      ctx,
      `${s.howtoPage + 1} / ${C.HOWTO_PAGES}`,
      640,
      530,
      18,
      teal,
      "center",
    );
    drawMenu(ctx, st, ["RETURN"]);
    return;
  }
  if (s.screen === "select") {
    label(
      ctx,
      s.mode === "campaign" ? "CAMPAIGN" : "EXTRAS",
      640,
      65,
      42,
      gold,
      "center",
    );
    const items = course(s.mode).map((c, i) => {
      const lock = s.mode === "campaign" && i >= s.unlockedCount;
      const solved = (
        s.mode === "campaign" ? s.campaignSolved : s.extrasSolved
      ).includes(i);
      const record = (
        s.mode === "campaign" ? s.campaignRecords : s.extrasRecords
      )[i];
      return `${String(i + 1).padStart(2, "0")}   ${c.name}      ${lock ? "LOCKED" : solved ? "SOLVED" : "OPEN"}${record ? `    COST ${record.cost}  CYCLES ${record.cycles}  AREA ${record.area}` : ""}`;
    });
    drawMenu(ctx, st, items);
    return;
  }
  if (!s.challenge) return;
  box(ctx, 0, 0, 1280, 48, "#0d1b28");
  label(ctx, s.challenge.name.toUpperCase(), 20, 31, 25, gold);
  label(
    ctx,
    `COST ${cost(s.editor.parts)}  •  SPACE RUN  •  N STEP  •  ESC BACK`,
    720,
    30,
    17,
    pale,
  );
  box(ctx, 0, 48, 224, 672, "#0d1b28");
  label(ctx, "WORKSHOP", 20, 80, 17, gold);
  tray(s.challenge).forEach((item, i) => {
    const y = C.TRAY_Y0 + i * C.TRAY_SLOT_H,
      spent =
        (item.kind === "rise" || item.kind === "set") &&
        s.editor.parts.some(
          (p) => p.kind === item.kind && p.index === item.index,
        );
    box(
      ctx,
      8,
      y,
      208,
      29,
      spent ? "#18232c" : "#1d3039",
      spent ? "#4b5659" : "#6f836f",
    );
    label(
      ctx,
      `${item.kind.toUpperCase()}${item.index !== null ? ` ${item.index + 1}` : ""}`,
      17,
      y + 21,
      16,
      spent ? "#647377" : pale,
    );
    label(ctx, String(C.PART_COSTS[item.kind]), 202, y + 21, 14, gold, "right");
  });
  ctx.save();
  ctx.beginPath();
  ctx.rect(224, 48, 784, 512);
  ctx.clip();
  for (const h of hexcells) {
    const p = xy(h);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + Math.PI / 6,
        xx = p.x + 26 * Math.cos(a),
        yy = p.y + 26 * Math.sin(a);
      if (i === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.closePath();
    ctx.strokeStyle = "#2b4651";
    ctx.stroke();
    ctx.fillStyle = "rgba(80,140,150,.035)";
    ctx.fill();
  }
  for (const p of s.editor.parts) {
    const poseCenter = s.sim?.poses.find((v) => v.part === p.id)?.cell ?? p;
    let pos = xy(poseCenter);
    const moving = s.sim?.poses.find((v) => v.part === p.id),
      command = moving ? visualCommand(s, p.id) : null;
    if (moving && (command === "advance" || command === "recede")) {
      const target = trackTarget(moving, s.editor.parts, command);
      if (target) {
        const end = xy(target);
        pos = {
          x: pos.x + (end.x - pos.x) * s.sim!.fraction,
          y: pos.y + (end.y - pos.y) * s.sim!.fraction,
        };
      }
    }
    const sel = s.editor.selected === p.id;
    ctx.strokeStyle = sel ? "#ffe4a0" : "#9d7b4e";
    ctx.lineWidth = sel ? 3 : 2;
    if (isSigil(p.kind)) {
      for (const h of footprint(p, s.challenge)) {
        const o = xy(h);
        ctx.beginPath();
        ctx.arc(o.x, o.y, 22, 0, Math.PI * 2);
        ctx.fillStyle = sel ? "rgba(255,217,145,.16)" : "rgba(198,156,91,.06)";
        ctx.fill();
        ctx.strokeStyle = sel ? "#ffe4a0" : "#765f43";
        ctx.lineWidth = sel ? 2 : 1;
        ctx.stroke();
      }
    }
    if (p.kind === "track") {
      ctx.beginPath();
      p.cells?.forEach((c, i) => {
        const o = xy(c);
        if (i === 0) ctx.moveTo(o.x, o.y);
        else ctx.lineTo(o.x, o.y);
      });
      ctx.stroke();
      continue;
    }
    if (rows(p)) {
      const pose = s.sim?.poses.find((v) => v.part === p.id),
        rot = pose?.rotation ?? p.rotation,
        len = pose?.length ?? p.length;
      for (const d of p.kind === "wheel"
        ? [0, 1, 2, 3, 4, 5]
        : spokeDirs(p, rot)) {
        const command = visualCommand(s, p.id),
          progress =
            command === "rotate-cw"
              ? (s.sim?.fraction ?? 0)
              : command === "rotate-ccw"
                ? -(s.sim?.fraction ?? 0)
                : 0;
        const visualLength =
          len +
          (command === "extend"
            ? (s.sim?.fraction ?? 0)
            : command === "retract"
              ? -(s.sim?.fraction ?? 0)
              : 0);
        const angle = ((d + progress) * Math.PI) / 3;
        const to = {
          x: pos.x + C.HEX_PITCH * visualLength * Math.cos(angle),
          y: pos.y + C.HEX_PITCH * visualLength * Math.sin(angle),
        };
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        if (p.kind !== "wheel")
          image(
            ctx,
            C.GRIPPER_PATHS[
              s.sim?.grips.some((g) => g.part === p.id && g.spoke === d)
                ? "closed"
                : "open"
            ],
            to.x,
            to.y,
            32,
            32,
            angle,
          );
      }
      image(
        ctx,
        p.kind === "wheel"
          ? C.WHEEL_HUB_PATH
          : p.kind === "piston"
            ? C.HUB_PATHS.piston
            : C.HUB_PATHS.arm,
        pos.x,
        pos.y,
        p.kind === "wheel" ? 48 : 40,
      );
      label(ctx, String(p.id), pos.x, pos.y + 5, 13, "#08141c", "center");
    } else if (p.kind === "rise" || p.kind === "set") {
      const frame =
        Math.floor(s.simTime / C.APERTURE_FRAME_TIME) % C.APERTURE_FRAMES;
      image(ctx, `${C.APERTURE_SHEETS[p.kind]}/${frame}.png`, pos.x, pos.y, 48);
      label(
        ctx,
        p.kind === "rise" ? "IN" : "OUT",
        pos.x,
        pos.y + 31,
        11,
        teal,
        "center",
      );
    } else
      image(
        ctx,
        C.SIGIL_GLYPH_PATHS[p.kind as keyof typeof C.SIGIL_GLYPH_PATHS],
        pos.x,
        pos.y,
        48,
      );
  }
  if (s.sim) {
    for (const f of s.sim.filaments) {
      const a = s.sim.motes.find((m) => m.id === f.a),
        b = s.sim.motes.find((m) => m.id === f.b);
      if (a && b) {
        const pa = visualMote(s, a),
          pb = visualMote(s, b);
        image(
          ctx,
          f.weight === 3
            ? C.FILAMENT_SPRITE_PATHS.triune
            : C.FILAMENT_SPRITE_PATHS.plain,
          (pa.x + pb.x) / 2,
          (pa.y + pb.y) / 2,
          48,
          16,
          Math.atan2(pb.y - pa.y, pb.x - pa.x),
        );
      }
    }
    for (const m of s.sim.motes) {
      const p = visualMote(s, m);
      image(ctx, C.MOTE_SPRITE_PATHS[m.type], p.x, p.y, 44);
    }
  }
  const signature = `${s.challenge.name}:${s.sim?.status}:${s.sim?.tallies.join(",")}`;
  if (s.sim && signature !== lastEffectKey) {
    const kind =
      s.sim.status === "faulted"
        ? "fault"
        : s.sim.status === "complete"
          ? "complete"
          : s.sim.tallies.some((n) => n > 0)
            ? "deliver"
            : null;
    if (kind) {
      const sys = particleSystems.get(kind);
      if (sys) {
        const anchor =
          kind === "complete"
            ? { q: 0, r: 0 }
            : kind === "fault"
              ? (s.sim.motes.find((m) => s.sim?.fault?.motes.includes(m.id)) ??
                s.editor.parts[0])
              : s.editor.parts.find((p) => p.kind === "set");
        const point = xy(anchor ?? { q: 0, r: 0 });
        liveEffects.push({
          player: new ParticleCanvasPlayer(sys, ctx, {
            clear: false,
            pixelRadius: 1.5,
          }),
          x: point.x,
          y: point.y,
          time: 0,
        });
      }
    }
    lastEffectKey = signature;
  }
  const effectDt = Math.max(0, Math.min(0.1, s.simTime - previousRenderTime));
  previousRenderTime = s.simTime;
  for (let i = liveEffects.length - 1; i >= 0; i--) {
    const e = liveEffects[i];
    ctx.save();
    ctx.translate(e.x - 640, e.y - 360);
    e.player.update(effectDt);
    ctx.restore();
    e.time += effectDt;
    if (e.time > 2.2) liveEffects.splice(i, 1);
  }
  if (s.editor.drag) {
    const h = s.editor.drag.kind === "lay" ? null : s.editor.drag.at;
    if (h) {
      const p = xy(h);
      const drag = s.editor.drag;
      const candidate =
        drag.kind === "place"
          ? {
              ...newPart(st, drag.part, h, drag.rotation, drag.index),
              length: drag.length,
            }
          : drag.kind === "move"
            ? (() => {
                const original = s.editor.parts.find((z) => z.id === drag.part);
                if (!original) return null;
                const dq = h.q - drag.from.q,
                  dr = h.r - drag.from.r;
                return {
                  ...original,
                  q: original.q + dq,
                  r: original.r + dr,
                  rotation: drag.rotation,
                  length: drag.length,
                  cells:
                    original.cells?.map((c) => ({
                      q: c.q + dq,
                      r: c.r + dr,
                    })) ?? null,
                };
              })()
            : null;
      const legal =
        candidate && !placementError(s.editor.parts, candidate, s.challenge);
      ctx.strokeStyle = legal ? teal : "#fb7770";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 25, 0, Math.PI * 2);
      ctx.stroke();
      if (candidate) {
        ctx.globalAlpha = 0.68;
        const path =
          candidate.kind === "rise" || candidate.kind === "set"
            ? `${C.APERTURE_SHEETS[candidate.kind]}/0.png`
            : candidate.kind === "wheel"
              ? C.WHEEL_HUB_PATH
              : arms.includes(candidate.kind)
                ? C.HUB_PATHS.arm
                : candidate.kind === "track"
                  ? null
                  : C.SIGIL_GLYPH_PATHS[
                      candidate.kind as keyof typeof C.SIGIL_GLYPH_PATHS
                    ];
        if (path)
          image(ctx, path, p.x, p.y, candidate.kind === "arm" ? 40 : 48);
        ctx.globalAlpha = 1;
      }
    }
  }
  if (s.sim?.fault) {
    for (const id of s.sim.fault.parts) {
      const part = s.editor.parts.find((p) => p.id === id);
      if (part) {
        const pos = xy(s.sim.poses.find((v) => v.part === id)?.cell ?? part);
        ctx.strokeStyle = "#ff7369";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 30, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    for (const id of s.sim.fault.motes) {
      const mote = s.sim.motes.find((m) => m.id === id);
      if (mote) {
        const pos = visualMote(s, mote);
        ctx.strokeStyle = "#ff7369";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 27, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    box(ctx, 360, 502, 512, 42, "rgba(61,18,25,.9)", "#ff7369");
    label(
      ctx,
      `MACHINE HALTED: ${s.sim.fault.kind.toUpperCase()}`,
      616,
      529,
      20,
      "#ffb8a7",
      "center",
    );
  }
  ctx.restore();
  box(ctx, 1008, 48, 272, 512, "#0d1b28");
  label(ctx, "OBSERVATORY", 1028, 80, 18, gold);
  label(
    ctx,
    `STATUS  ${s.sim?.status.toUpperCase() ?? "EDITING"}`,
    1028,
    121,
    17,
    teal,
  );
  label(ctx, `CYCLE  ${s.sim?.cycle ?? 0}`, 1028, 156, 17, pale);
  label(ctx, `PERIOD  ${period(s.editor.parts)}`, 1028, 191, 17, pale);
  label(
    ctx,
    `SPEED  ${s.sim ? C.SPEEDS[s.sim.speed] : C.SPEEDS[C.DEFAULT_SPEED_INDEX]}×`,
    1028,
    226,
    17,
    pale,
  );
  s.challenge.products.forEach((_, i) =>
    label(
      ctx,
      `PRODUCT ${i + 1}   ${s.sim?.tallies[i] ?? 0} / ${s.challenge!.target}`,
      1028,
      270 + i * 30,
      16,
      gold,
    ),
  );
  label(ctx, "REAGENTS", 1028, 338, 14, teal);
  s.challenge.reagents.forEach((m, i) =>
    label(ctx, `${i + 1}. ${patternLabel(m)}`, 1028, 360 + i * 21, 12, pale),
  );
  const productY = 370 + s.challenge.reagents.length * 21;
  label(ctx, "PRODUCTS", 1028, productY, 14, teal);
  s.challenge.products.forEach((m, i) =>
    label(
      ctx,
      `${i + 1}. ${patternLabel(m)}`,
      1028,
      productY + 22 + i * 21,
      12,
      pale,
    ),
  );
  if (!s.sim) {
    const rises = s.editor.parts.filter((p) => p.kind === "rise").length,
      sets = s.editor.parts.filter((p) => p.kind === "set").length;
    if (
      rises < s.challenge.reagents.length ||
      sets < s.challenge.products.length
    )
      label(
        ctx,
        `PLACE ${s.challenge.reagents.length - rises} RISE / ${s.challenge.products.length - sets} SET`,
        1028,
        528,
        14,
        "#ffb8a7",
      );
  }
  if (s.sim?.fault)
    label(
      ctx,
      `FAULT: ${s.sim.fault.kind.toUpperCase()}`,
      1028,
      480,
      19,
      "#ff8a7a",
    );
  box(ctx, 224, 560, 1056, 160, "#0b1925");
  const window = tapeWindow(st.editor);
  window.rowsList
    .slice(window.firstRow, window.firstRow + C.TAPE_ROWS_VISIBLE)
    .forEach((p, ri) => {
      const y = C.TAPE_Y0 + ri * C.TAPE_ROW_H;
      label(
        ctx,
        `${p.kind.slice(0, 3).toUpperCase()} ${p.id}`,
        230,
        y + 17,
        13,
        pale,
      );
      label(
        ctx,
        `${p.tape?.length ?? 0}/${period(s.editor.parts)}`,
        304,
        y + 17,
        11,
        teal,
        "right",
      );
      for (let visible = 0; visible < C.TAPE_COLS_VISIBLE; visible++) {
        const col = window.firstCol + visible,
          x = 312 + visible * C.TAPE_CELL_W;
        const current =
          s.editor.cursor?.part === p.id && s.editor.cursor.col === col;
        ctx.strokeStyle = current ? "#f5cc82" : "#344c55";
        ctx.strokeRect(x, y, 23, 27);
        const ins = p.tape?.[col];
        if (ins) image(ctx, C.INSTRUCTION_GLYPH_PATHS[ins], x + 12, y + 14, 24);
      }
    });
  label(
    ctx,
    "G GRAB  V DROP  A/D TURN  Z/C PIVOT  W/S REACH  T/B TRACK  R RESET  Y REPEAT",
    320,
    714,
    11,
    "#879da0",
  );
  if (s.sim?.status === "complete") {
    box(ctx, 364, 176, 552, 403, "rgba(8,22,32,.89)", gold);
    label(ctx, C.SOLVED_TITLE_TEXT, 640, 231, 32, gold, "center");
    const m = s.sim.metrics!;
    label(
      ctx,
      `COST ${m.cost}    CYCLES ${m.cycles}    AREA ${m.area}`,
      640,
      285,
      20,
      pale,
      "center",
    );
    const records = s.challengeRef
      ? (s.mode === "campaign" ? s.campaignRecords : s.extrasRecords)[
          s.challengeRef.index
        ]
      : null;
    if (records)
      label(
        ctx,
        `BEST  COST ${records.cost}  •  CYCLES ${records.cycles}  •  AREA ${records.area}`,
        640,
        326,
        16,
        teal,
        "center",
      );
    drawMenu(
      ctx,
      st,
      menuCount(st) === 3 ? C.SOLVED_ITEMS : C.SOLVED_ITEMS.slice(1),
    );
  }
};
const needChallenge = (s: DeepReadonly<OrreryState>) => {
  if (!s.challenge) throw Error("no challenge open");
  return s as OrreryState;
};
const needSim = (s: DeepReadonly<OrreryState>) => {
  if (!s.sim) throw Error("no live run");
  return s as OrreryState;
};
const applyPart = (s: DeepReadonly<OrreryState>, p: PartState): OrreryState =>
  usePart(needChallenge(s), p);
const modSim = (
  s: DeepReadonly<OrreryState>,
  fn: (sim: SimState) => SimState,
): OrreryState => {
  const v = needSim(s);
  return { ...v, sim: fn(v.sim!) };
};
export interface SolutionPart {
  kind: PartKind;
  q?: number;
  r?: number;
  rotation?: number;
  length?: number;
  tape?: readonly TapeCell[];
  cells?: readonly Hex[];
  closed?: boolean;
  index?: number;
}
export interface Solution {
  parts: readonly SolutionPart[];
}
const serializeSolution = (parts: readonly PartState[]): Solution => ({
  parts: parts.map((p) =>
    p.kind === "track"
      ? { kind: p.kind, cells: p.cells ?? [], closed: p.closed ?? false }
      : rows(p)
        ? {
            kind: p.kind,
            q: p.q,
            r: p.r,
            rotation: p.rotation,
            length: p.length,
            tape: p.tape ?? [],
          }
        : p.kind === "rise" || p.kind === "set"
          ? {
              kind: p.kind,
              q: p.q,
              r: p.r,
              rotation: p.rotation,
              index: p.index ?? 0,
            }
          : { kind: p.kind, q: p.q, r: p.r, rotation: p.rotation },
  ),
});
const validateChallenge = (raw: Challenge): Challenge => {
  if (
    !raw ||
    typeof raw.name !== "string" ||
    raw.name.length < 1 ||
    raw.name.length > C.NAME_MAX
  )
    throw Error("invalid challenge name");
  if (
    !Array.isArray(raw.reagents) ||
    !raw.reagents.length ||
    !Array.isArray(raw.products) ||
    !raw.products.length
  )
    throw Error("challenge needs reagents and products");
  if (
    !Array.isArray(raw.permitted) ||
    !raw.permitted.length ||
    raw.permitted.some((p) => !C.PARTS.slice(0, -2).includes(p)) ||
    new Set(raw.permitted).size !== raw.permitted.length ||
    raw.permitted.length + raw.reagents.length + raw.products.length >
      C.TRAY_MAX
  )
    throw Error("invalid permitted parts or tray size");
  if (!Number.isInteger(raw.target) || raw.target < 1)
    throw Error("invalid target");
  for (const pattern of [...raw.reagents, ...raw.products]) {
    if (
      !Array.isArray(pattern.motes) ||
      !pattern.motes.length ||
      !Array.isArray(pattern.filaments)
    )
      throw Error("invalid molecule");
    const sites = new Set<string>();
    for (const m of pattern.motes) {
      if (
        !Number.isInteger(m.q) ||
        !Number.isInteger(m.r) ||
        !C.MOTES.includes(m.type)
      )
        throw Error("invalid mote");
      if (sites.has(key(m))) throw Error("duplicate mote hex");
      sites.add(key(m));
    }
    for (const f of pattern.filaments) {
      if (
        !sites.has(key(f.a)) ||
        !sites.has(key(f.b)) ||
        !C.DIRS.some(([q, r]) => same(add(f.a, { q, r }), f.b)) ||
        ![1, 3].includes(f.weight)
      )
        throw Error("invalid filament");
    }
    if (pattern.repeat && same(pattern.repeat.vector, { q: 0, r: 0 }))
      throw Error("invalid repeat vector");
  }
  return {
    ...raw,
    reagents: raw.reagents.map(normMol),
    products: raw.products.map(normMol),
  };
};
const pairFeed: TapeCell[] = [
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
const pairCarrier: TapeCell[] = [
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
const pairReference = (sigil: PartKind): Solution => ({
  parts: [
    { kind: "rise", index: 0, q: 2, r: 0, rotation: 0 },
    { kind: "set", index: 0, q: -1, r: 1, rotation: 1 },
    { kind: sigil, q: 0, r: 1, rotation: 0 },
    { kind: "arm", q: 1, r: 0, rotation: 0, length: 1, tape: pairFeed },
    { kind: "arm", q: 0, r: 0, rotation: 1, length: 1, tape: pairCarrier },
  ],
});
const extraReferences: Readonly<Record<number, Solution>> = {
  1: pairReference("bind"),
  2: {
    parts: [
      { kind: "rise", index: 0, q: 2, r: 0, rotation: 0 },
      { kind: "set", index: 0, q: -1, r: 1, rotation: 2 },
      { kind: "wane", q: 1, r: 1, rotation: 0 },
      { kind: "bind", q: 0, r: 0, rotation: 1 },
      {
        kind: "arm",
        q: 1,
        r: 0,
        rotation: 0,
        length: 1,
        tape: [
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
        ],
      },
      {
        kind: "arm",
        q: -1,
        r: 0,
        rotation: 0,
        length: 1,
        tape: [
          ...Array(12).fill(null),
          "grab",
          "rotate-cw",
          "drop",
          "rotate-ccw",
        ],
      },
    ],
  },
  3: {
    parts: [
      { kind: "rise", index: 0, q: 3, r: 0, rotation: 0 },
      {
        kind: "wheel",
        q: 1,
        r: -1,
        rotation: 5,
        length: 1,
        tape: [
          ...Array(8).fill(null),
          "rotate-cw",
          ...Array(10).fill(null),
          "rotate-ccw",
          ...Array(4).fill(null),
        ],
      },
      { kind: "mirror", q: 1, r: 0, rotation: 1 },
      { kind: "bind", q: -1, r: 2, rotation: 0 },
      { kind: "set", index: 0, q: -2, r: 3, rotation: 1 },
      ...(
        [
          {
            q: 2,
            r: 0,
            rotation: 0,
            tape: [
              "grab",
              "rotate-cw",
              "rotate-cw",
              "drop",
              "rotate-ccw",
              "rotate-ccw",
              null,
              null,
              null,
              "grab",
              "rotate-cw",
              "rotate-cw",
              "drop",
              "rotate-ccw",
              "rotate-ccw",
            ],
          },
          {
            q: 0,
            r: 1,
            rotation: 0,
            tape: [
              null,
              null,
              null,
              null,
              "grab",
              "rotate-cw",
              "rotate-cw",
              "drop",
              "rotate-ccw",
              "rotate-ccw",
              null,
              null,
              null,
              "grab",
              "rotate-cw",
              "drop",
              "rotate-ccw",
            ],
          },
          {
            q: -2,
            r: 2,
            rotation: 0,
            tape: [
              ...Array(16).fill(null),
              "grab",
              "rotate-cw",
              "drop",
              "rotate-ccw",
            ],
          },
        ] as { q: number; r: number; rotation: number; tape: TapeCell[] }[]
      ).map((p) => ({
        kind: "arm" as const,
        ...p,
        length: 1,
        tape: [
          ...p.tape,
          ...Array(24 - p.tape.length).fill(null),
        ] as TapeCell[],
      })),
    ],
  },
  4: {
    parts: [
      { kind: "rise", index: 0, q: 2, r: 0, rotation: 0 },
      { kind: "rise", index: 1, q: 3, r: 0, rotation: 0 },
      { kind: "set", index: 0, q: 0, r: 2, rotation: 0 },
      { kind: "ascend", q: 0, r: 1, rotation: 0 },
      {
        kind: "arm",
        q: 1,
        r: 0,
        rotation: 0,
        length: 1,
        tape: [
          "grab",
          "rotate-cw",
          "rotate-cw",
          "drop",
          "rotate-ccw",
          "rotate-ccw",
        ],
      },
      {
        kind: "arm",
        q: 2,
        r: 0,
        rotation: 0,
        length: 1,
        tape: [
          null,
          null,
          null,
          "grab",
          "rotate-cw",
          "rotate-cw",
          "drop",
          "rotate-ccw",
          "rotate-ccw",
        ],
      },
      {
        kind: "arm",
        q: 0,
        r: 1,
        rotation: 0,
        length: 1,
        tape: [
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
        ],
      },
    ],
  },
  5: {
    parts: [
      { kind: "rise", index: 0, q: 2, r: 0, rotation: 0 },
      { kind: "set", index: 0, q: -1, r: 2, rotation: 0 },
      { kind: "conjoin", q: 0, r: 1, rotation: 0 },
      { kind: "arm", q: 1, r: 0, rotation: 0, length: 1, tape: pairFeed },
      { kind: "arm", q: 0, r: 1, rotation: 1, length: 1, tape: pairCarrier },
    ],
  },
  6: {
    parts: [
      { kind: "rise", index: 0, q: 2, r: 0, rotation: 0 },
      { kind: "eclipse", q: 0, r: 1, rotation: 0 },
      { kind: "bind", q: 1, r: 2, rotation: 5 },
      { kind: "set", index: 0, q: 0, r: 3, rotation: 0 },
      ...(
        [
          { q: 1, r: 0, rotation: 0, tape: pairFeed },
          {
            q: 1,
            r: 1,
            rotation: 2,
            tape: [
              ...Array(12).fill(null),
              "grab",
              "rotate-ccw",
              "drop",
              "rotate-cw",
            ],
          },
          {
            q: 2,
            r: 0,
            rotation: 3,
            tape: [
              ...Array(9).fill(null),
              "grab",
              "rotate-ccw",
              "rotate-ccw",
              "drop",
              "rotate-cw",
              "rotate-cw",
            ],
          },
          {
            q: 0,
            r: 2,
            rotation: 0,
            tape: [
              ...Array(16).fill(null),
              "grab",
              "rotate-cw",
              "drop",
              "rotate-ccw",
            ],
          },
        ] as { q: number; r: number; rotation: number; tape: TapeCell[] }[]
      ).map((p) => ({
        kind: "arm" as const,
        ...p,
        length: 1,
        tape: [
          ...p.tape,
          ...Array(24 - p.tape.length).fill(null),
        ] as TapeCell[],
      })),
    ],
  },
  7: {
    parts: [
      { kind: "confluence", q: 0, r: 0, rotation: 0 },
      { kind: "set", index: 0, q: -1, r: 1, rotation: 0 },
      { kind: "rise", index: 0, q: 3, r: -1, rotation: 0 },
      { kind: "rise", index: 1, q: 2, r: 1, rotation: 0 },
      { kind: "rise", index: 2, q: -3, r: 1, rotation: 0 },
      { kind: "rise", index: 3, q: -2, r: -1, rotation: 0 },
      ...(
        [
          {
            q: 2,
            r: -1,
            rotation: 0,
            tape: [
              "grab",
              "rotate-cw",
              "rotate-cw",
              "drop",
              "rotate-ccw",
              "rotate-ccw",
            ],
          },
          {
            q: 1,
            r: 1,
            rotation: 0,
            tape: [
              "grab",
              "rotate-cw",
              "rotate-cw",
              "rotate-cw",
              "drop",
              "rotate-ccw",
              "rotate-ccw",
              "rotate-ccw",
            ],
          },
          {
            q: -2,
            r: 1,
            rotation: 3,
            tape: [
              "grab",
              "rotate-cw",
              "rotate-cw",
              "drop",
              "rotate-ccw",
              "rotate-ccw",
            ],
          },
          {
            q: -1,
            r: -1,
            rotation: 3,
            tape: [
              "grab",
              "rotate-cw",
              "rotate-cw",
              "rotate-cw",
              "drop",
              "rotate-ccw",
              "rotate-ccw",
              "rotate-ccw",
            ],
          },
          {
            q: -1,
            r: 0,
            rotation: 0,
            tape: [
              null,
              null,
              null,
              null,
              null,
              "grab",
              "rotate-cw",
              "drop",
              "rotate-ccw",
            ],
          },
        ] as { q: number; r: number; rotation: number; tape: TapeCell[] }[]
      ).map((p) => ({
        kind: "arm" as const,
        ...p,
        length: 1,
        tape: [
          ...p.tape,
          ...Array(16 - p.tape.length).fill(null),
        ] as TapeCell[],
      })),
    ],
  },
  8: pairReference("triune"),
  9: pairReference("bind"),
};
const reference = (mode: Mode, index: number): Solution => {
  const challenge = course(mode)[index];
  if (!challenge) throw Error("challenge index outside course");
  const base: SolutionPart[] = [
    {
      kind: "arm",
      q: 0,
      r: 0,
      rotation: 0,
      length: 1,
      tape: ["grab", "rotate-cw", "drop", "rotate-ccw"],
    },
    { kind: "rise", index: 0, q: 1, r: 0, rotation: 0 },
    { kind: "set", index: 0, q: 0, r: 1, rotation: 0 },
  ];
  if (mode === "extras") return extraReferences[index] ?? { parts: base };
  const core = extraReferences[campaignSeedIndices[index]] ?? { parts: base };
  let state = open(fresh(), mode, index);
  for (const p of core.parts) {
    const origin = { q: p.q ?? 0, r: p.r ?? 0 };
    state = usePart(state, {
      ...newPart(state, p.kind, origin, p.rotation ?? 0, p.index ?? null),
      length: p.length ?? 1,
      tape: p.tape ?? null,
    });
  }
  for (const kind of referenceExtras[index]) {
    if (core.parts.some((p) => p.kind === kind)) continue;
    let placed = false;
    for (const h of [...hexcells].sort(
      (a, b) =>
        Math.max(Math.abs(b.q), Math.abs(b.r), Math.abs(b.q + b.r)) -
        Math.max(Math.abs(a.q), Math.abs(a.r), Math.abs(a.q + a.r)),
    )) {
      if (Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(h.q + h.r)) < 3)
        continue;
      for (let r = 0; r < 6; r++) {
        const candidate = newPart(state, kind, h, r);
        if (!placementError(state.editor.parts, candidate, challenge)) {
          state = usePart(state, candidate);
          placed = true;
          break;
        }
      }
      if (placed) break;
    }
    if (!placed) throw Error(`could not place reference ${kind}`);
  }
  const solution = serializeSolution(state.editor.parts);
  if (index === campaign.length - 1)
    return {
      parts: solution.parts.map((p) =>
        p.tape
          ? { ...p, tape: [...p.tape, ...Array(25 - p.tape.length).fill(null)] }
          : p,
      ),
    };
  return solution;
};
const whole = (n: number, label: string, min = 0, max = Infinity) => {
  if (!Number.isInteger(n) || n < min || n > max)
    throw Error(`invalid ${label}`);
  return n;
};
const findMote = (sim: SimState, id: number) => {
  const mote = sim.motes.find((m) => m.id === id);
  if (!mote) throw Error(`unknown mote ${id}`);
  return mote;
};
const findPose = (sim: SimState, id: number) => {
  const pose = sim.poses.find((p) => p.part === id);
  if (!pose) throw Error(`unknown live part ${id}`);
  return pose;
};
const checkMode = (mode: Mode) => {
  if (mode !== "campaign" && mode !== "extras") throw Error("invalid mode");
  return mode;
};
const checkModeIndex = (mode: Mode, index: number) =>
  whole(
    index,
    `${checkMode(mode)} challenge index`,
    0,
    course(mode).length - 1,
  );
const debug = {
  version: C.ORRERY_DEBUG_VERSION,
  reset: (s: DeepReadonly<OrreryState>) => {
    pendingPointerCues.clear();
    return { ...fresh(), muted: s.muted };
  },
  reconcile: (s: DeepReadonly<OrreryState>) => s as OrreryState,
  setCompletion: (s: DeepReadonly<OrreryState>, enabled: boolean) =>
    ({ ...s, completion: enabled }) as OrreryState,
  setScreen: (s: DeepReadonly<OrreryState>, name: Screen) =>
    name === "editor"
      ? { ...needChallenge(s), screen: name }
      : s.screen === "editor"
        ? close(s as OrreryState, name)
        : ({
            ...s,
            screen: name,
            menuIndex: name === "title" ? s.titleIndex : s.menuIndex,
            howtoPage: name === "howto" ? 0 : s.howtoPage,
            selectIndex:
              name === "select"
                ? s.mode === "campaign"
                  ? s.campaignLast
                  : s.extrasLast
                : s.selectIndex,
          } as OrreryState),
  setMode: (s: DeepReadonly<OrreryState>, mode: Mode) =>
    ({ ...s, mode: checkMode(mode) }) as OrreryState,
  setMenuIndex: (s: DeepReadonly<OrreryState>, n: number) =>
    ({
      ...s,
      menuIndex: whole(n, "menu index", 0, menuCount(s as OrreryState) - 1),
    }) as OrreryState,
  setSelectIndex: (s: DeepReadonly<OrreryState>, n: number) =>
    ({ ...s, selectIndex: checkModeIndex(s.mode, n) }) as OrreryState,
  setHowtoPage: (s: DeepReadonly<OrreryState>, n: number) =>
    ({
      ...s,
      howtoPage: whole(n, "howto page", 0, C.HOWTO_PAGES - 1),
    }) as OrreryState,
  setUnlockedCount: (s: DeepReadonly<OrreryState>, n: number) =>
    ({
      ...s,
      unlockedCount: whole(n, "unlocked count", 1, campaign.length),
    }) as OrreryState,
  setSolved: (
    s: DeepReadonly<OrreryState>,
    mode: Mode,
    index: number,
    solved: boolean,
  ) =>
    ({
      ...s,
      [mode === "campaign" ? "campaignSolved" : "extrasSolved"]:
        (checkModeIndex(mode, index), solved)
          ? [
              ...new Set([
                ...(mode === "campaign" ? s.campaignSolved : s.extrasSolved),
                index,
              ]),
            ].sort((a, b) => a - b)
          : (mode === "campaign" ? s.campaignSolved : s.extrasSolved).filter(
              (n) => n !== index,
            ),
    }) as OrreryState,
  setRecord: (
    s: DeepReadonly<OrreryState>,
    mode: Mode,
    index: number,
    metric: keyof Metrics,
    value: number,
  ) => {
    checkModeIndex(mode, index);
    whole(value, "record value");
    if (!["cost", "cycles", "area"].includes(metric))
      throw Error("invalid metric");
    const field = mode === "campaign" ? "campaignRecords" : "extrasRecords",
      arr = [...s[field]];
    arr[index] = {
      ...(arr[index] ?? { cost: 0, cycles: 0, area: 0 }),
      [metric]: value,
    };
    return { ...s, [field]: arr } as OrreryState;
  },
  setLast: (s: DeepReadonly<OrreryState>, mode: Mode, index: number) =>
    ({
      ...s,
      [mode === "campaign" ? "campaignLast" : "extrasLast"]: checkModeIndex(
        mode,
        index,
      ),
    }) as OrreryState,
  menuItemRect: (s: DeepReadonly<OrreryState>, index: number) =>
    menuRect(s as OrreryState, index),
  openChallenge: (s: DeepReadonly<OrreryState>, mode: Mode, index: number) =>
    open(s as OrreryState, mode, index),
  loadChallenge: (s: DeepReadonly<OrreryState>, challenge: Challenge) =>
    ({
      ...s,
      screen: "editor",
      challenge: validateChallenge(challenge),
      challengeRef: null,
      editor: emptyEditor(),
      sim: null,
    }) as OrreryState,
  referenceSolution: (
    _s: DeepReadonly<OrreryState>,
    mode: Mode,
    index: number,
  ) => reference(mode, index),
  clearMachine: (s: DeepReadonly<OrreryState>) => {
    let v = needChallenge(s);
    for (const p of s.editor.parts) v = debug.removePart(v, p.id);
    return { ...v, editor: emptyEditor() };
  },
  placePart: (
    s: DeepReadonly<OrreryState>,
    kind: PartKind,
    q: number,
    r: number,
    rotation: number,
  ) => {
    if (["rise", "set", "track"].includes(kind))
      throw Error("use specific placement");
    return applyPart(s, newPart(s as OrreryState, kind, { q, r }, rotation));
  },
  placeRise: (
    s: DeepReadonly<OrreryState>,
    index: number,
    q: number,
    r: number,
    rotation: number,
  ) =>
    applyPart(s, newPart(s as OrreryState, "rise", { q, r }, rotation, index)),
  placeSet: (
    s: DeepReadonly<OrreryState>,
    index: number,
    q: number,
    r: number,
    rotation: number,
  ) =>
    applyPart(s, newPart(s as OrreryState, "set", { q, r }, rotation, index)),
  placeTrack: (s: DeepReadonly<OrreryState>, q: number, r: number) =>
    applyPart(s, newPart(s as OrreryState, "track", { q, r })),
  extendTrack: (
    s: DeepReadonly<OrreryState>,
    part: number,
    q: number,
    r: number,
  ) =>
    updatePart(needChallenge(s), part, (p) => ({
      ...p,
      cells: [...(p.cells ?? []), { q, r }],
    })),
  closeTrack: (s: DeepReadonly<OrreryState>, part: number) =>
    updatePart(needChallenge(s), part, (p) => ({ ...p, closed: true })),
  removePart: (s: DeepReadonly<OrreryState>, part: number) => {
    needChallenge(s);
    if (!s.editor.parts.some((p) => p.id === part)) throw Error("unknown part");
    const sim = s.sim
      ? {
          ...s.sim,
          poses: s.sim.poses.filter((p) => p.part !== part),
          grips: s.sim.grips.filter((g) => g.part !== part),
          motes: s.sim.motes.filter((m) => m.wheel !== part),
          filaments: s.sim.filaments.filter(
            (f) =>
              !s.sim!.motes.some(
                (m) => m.wheel === part && [f.a, f.b].includes(m.id),
              ),
          ),
        }
      : null;
    return {
      ...s,
      editor: {
        ...s.editor,
        parts: s.editor.parts.filter((p) => p.id !== part),
        selected: s.editor.selected === part ? null : s.editor.selected,
        cursor: s.editor.cursor?.part === part ? null : s.editor.cursor,
      },
      sim,
    } as OrreryState;
  },
  setPartRotation: (
    s: DeepReadonly<OrreryState>,
    part: number,
    rotation: number,
  ) => updatePart(needChallenge(s), part, (p) => ({ ...p, rotation })),
  setPartLength: (s: DeepReadonly<OrreryState>, part: number, length: number) =>
    updatePart(needChallenge(s), part, (p) => ({ ...p, length })),
  movePart: (
    s: DeepReadonly<OrreryState>,
    part: number,
    q: number,
    r: number,
  ) =>
    updatePart(needChallenge(s), part, (p) => {
      const dq = q - p.q,
        dr = r - p.r;
      return {
        ...p,
        q,
        r,
        cells: p.cells?.map((c) => ({ q: c.q + dq, r: c.r + dr })) ?? null,
      };
    }),
  setTapeCell: (
    s: DeepReadonly<OrreryState>,
    part: number,
    col: number,
    instruction: TapeCell,
  ) =>
    updatePart(needChallenge(s), part, (p) => {
      whole(col, "tape column");
      if (p.tape === null) throw Error("part has no tape row");
      if (instruction !== null && !C.INSTRUCTIONS.includes(instruction))
        throw Error("invalid instruction");
      const tape = [...(p.tape ?? [])];
      while (tape.length <= col) tape.push(null);
      tape[col] = instruction;
      while (tape.length && tape[tape.length - 1] === null) tape.pop();
      return { ...p, tape };
    }),
  loadSolution: (s: DeepReadonly<OrreryState>, solution: Solution) => {
    let v = debug.clearMachine(needChallenge(s));
    for (const part of solution.parts) {
      if (
        !v.challenge?.permitted.includes(part.kind) &&
        part.kind !== "rise" &&
        part.kind !== "set"
      )
        throw Error("solution part not permitted");
      const origin = part.cells?.[0] ?? { q: part.q ?? 0, r: part.r ?? 0 };
      const p = {
        ...newPart(
          v,
          part.kind,
          origin,
          part.rotation ?? 0,
          part.index ?? null,
        ),
        length: part.length ?? 1,
        cells: part.kind === "track" ? (part.cells ?? [origin]) : null,
        closed: part.kind === "track" ? (part.closed ?? false) : null,
        tape: rows({ kind: part.kind } as PartState) ? (part.tape ?? []) : null,
      };
      v = usePart(v, p);
    }
    return v;
  },
  readSolution: (s: DeepReadonly<OrreryState>) =>
    serializeSolution(s.editor.parts),
  setSelected: (s: DeepReadonly<OrreryState>, part: number | null) => {
    if (part !== null && !s.editor.parts.some((p) => p.id === part))
      throw Error("unknown part");
    return { ...s, editor: { ...s.editor, selected: part } } as OrreryState;
  },
  setFocus: (s: DeepReadonly<OrreryState>, focus: Focus) => {
    if (focus !== "field" && focus !== "tape") throw Error("invalid focus");
    return { ...s, editor: { ...s.editor, focus } } as OrreryState;
  },
  setCursor: (
    s: DeepReadonly<OrreryState>,
    part: number | null,
    col: number,
  ) => {
    if (part !== null) {
      whole(col, "cursor column");
      const row = s.editor.parts.find((p) => p.id === part);
      if (!row || !rows(row)) throw Error("part has no tape row");
    }
    return {
      ...s,
      editor: { ...s.editor, cursor: part === null ? null : { part, col } },
    } as OrreryState;
  },
  pointerDown: (s: DeepReadonly<OrreryState>, x: number, y: number) =>
    pointerEvent(s as OrreryState, "down", x, y),
  pointerMove: (s: DeepReadonly<OrreryState>, x: number, y: number) =>
    pointerEvent(s as OrreryState, "move", x, y),
  pointerUp: (s: DeepReadonly<OrreryState>) =>
    pointerEvent(s as OrreryState, "up", s.pointer.x, s.pointer.y),
  startRun: (s: DeepReadonly<OrreryState>) => start(needChallenge(s)),
  stopRun: (s: DeepReadonly<OrreryState>) =>
    ({ ...needSim(s), sim: null }) as OrreryState,
  setPaused: (s: DeepReadonly<OrreryState>, paused: boolean) =>
    modSim(s, (sim) => {
      if (sim.status === "faulted" || sim.status === "complete")
        throw Error("run is stopped");
      return { ...sim, status: paused ? "paused" : "running" };
    }),
  setSpeed: (s: DeepReadonly<OrreryState>, speed: number) =>
    modSim(s, (sim) => ({
      ...sim,
      speed: whole(speed, "speed", 0, C.SPEEDS.length - 1),
    })),
  setCycle: (s: DeepReadonly<OrreryState>, cycle: number) =>
    modSim(s, (sim) => ({ ...sim, cycle: whole(cycle, "cycle") })),
  setTally: (s: DeepReadonly<OrreryState>, index: number, n: number) =>
    modSim(s, (sim) => {
      whole(index, "tally index", 0, sim.tallies.length - 1);
      whole(n, "tally");
      return {
        ...sim,
        tallies: sim.tallies.map((v, i) => (i === index ? n : v)),
      };
    }),
  clearMotes: (s: DeepReadonly<OrreryState>) =>
    modSim(s, (sim) => ({ ...sim, motes: [], filaments: [], grips: [] })),
  spawnMote: (
    s: DeepReadonly<OrreryState>,
    q: number,
    r: number,
    type: MoteType,
  ) =>
    modSim(s, (sim) => {
      if (
        !Number.isInteger(q) ||
        !Number.isInteger(r) ||
        !C.MOTES.includes(type)
      )
        throw Error("invalid mote");
      if (sim.motes.some((m) => m.q === q && m.r === r))
        throw Error("mote hex occupied");
      return spawn(sim, { q, r }, type);
    }),
  removeMote: (s: DeepReadonly<OrreryState>, id: number) =>
    modSim(s, (sim) => {
      findMote(sim, id);
      return {
        ...sim,
        motes: sim.motes.filter((m) => m.id !== id),
        filaments: sim.filaments.filter((f) => f.a !== id && f.b !== id),
        grips: sim.grips.filter((g) => g.mote !== id),
      };
    }),
  linkMotes: (
    s: DeepReadonly<OrreryState>,
    a: number,
    b: number,
    weight: number,
  ) =>
    modSim(s, (sim) => {
      const x = findMote(sim, a),
        y = findMote(sim, b);
      if (
        x.wheel !== null ||
        y.wheel !== null ||
        ![1, 3].includes(weight) ||
        !C.DIRS.some(([q, r]) => same(add(x, { q, r }), y)) ||
        sim.filaments.some(
          (f) => (f.a === a && f.b === b) || (f.a === b && f.b === a),
        )
      )
        throw Error("invalid filament");
      return { ...sim, filaments: [...sim.filaments, { a, b, weight }] };
    }),
  unlinkMotes: (s: DeepReadonly<OrreryState>, a: number, b: number) =>
    modSim(s, (sim) => {
      if (
        !sim.filaments.some(
          (f) => (f.a === a && f.b === b) || (f.a === b && f.b === a),
        )
      )
        throw Error("filament not found");
      return {
        ...sim,
        filaments: sim.filaments.filter(
          (f) => !((f.a === a && f.b === b) || (f.a === b && f.b === a)),
        ),
      };
    }),
  setGrip: (
    s: DeepReadonly<OrreryState>,
    part: number,
    spoke: number,
    mote: number,
  ) =>
    modSim(s, (sim) => {
      const subject = s.editor.parts.find((p) => p.id === part),
        pose = findPose(sim, part),
        body = findMote(sim, mote);
      whole(spoke, "spoke", 0, 5);
      if (
        !subject ||
        !arms.includes(subject.kind) ||
        !spokeDirs(subject, pose.rotation).includes(spoke) ||
        body.wheel !== null ||
        !same(body, add(pose.cell, offset(spoke, pose.length)))
      )
        throw Error("invalid grip");
      return {
        ...sim,
        grips: [
          ...sim.grips.filter((g) => !(g.part === part && g.spoke === spoke)),
          { part, spoke, mote },
        ],
      };
    }),
  releaseGrip: (s: DeepReadonly<OrreryState>, part: number, spoke: number) =>
    modSim(s, (sim) => {
      const subject = s.editor.parts.find((p) => p.id === part),
        pose = findPose(sim, part);
      whole(spoke, "spoke", 0, 5);
      if (
        !subject ||
        !arms.includes(subject.kind) ||
        !spokeDirs(subject, pose.rotation).includes(spoke)
      )
        throw Error("invalid gripper");
      return {
        ...sim,
        grips: sim.grips.filter((g) => !(g.part === part && g.spoke === spoke)),
      };
    }),
  setPoseRotation: (
    s: DeepReadonly<OrreryState>,
    part: number,
    rotation: number,
  ) =>
    modSim(s, (sim) => {
      findPose(sim, part);
      whole(rotation, "rotation", 0, 5);
      return {
        ...sim,
        poses: sim.poses.map((p) => (p.part === part ? { ...p, rotation } : p)),
      };
    }),
  setPoseLength: (s: DeepReadonly<OrreryState>, part: number, length: number) =>
    modSim(s, (sim) => {
      findPose(sim, part);
      const subject = s.editor.parts.find((p) => p.id === part);
      if (!subject || !arms.includes(subject.kind))
        throw Error("part has no length");
      whole(length, "length", 1, 3);
      return {
        ...sim,
        poses: sim.poses.map((p) => (p.part === part ? { ...p, length } : p)),
      };
    }),
  setPoseCell: (
    s: DeepReadonly<OrreryState>,
    part: number,
    q: number,
    r: number,
  ) =>
    modSim(s, (sim) => {
      const pose = findPose(sim, part);
      if (
        !s.editor.parts.some(
          (p) =>
            p.kind === "track" &&
            p.cells?.some((h) => same(h, pose.cell)) &&
            p.cells?.some((h) => h.q === q && h.r === r),
        )
      )
        throw Error("cell is not on a track");
      return {
        ...sim,
        poses: sim.poses.map((p) =>
          p.part === part ? { ...p, cell: { q, r } } : p,
        ),
      };
    }),
  snapshot: (s: DeepReadonly<OrreryState>) => ({
    version: C.ORRERY_DEBUG_VERSION,
    screen: s.screen,
    mode: s.mode,
    menuIndex: s.menuIndex,
    titleIndex: s.titleIndex,
    selectIndex: s.selectIndex,
    howtoPage: s.howtoPage,
    campaign: {
      count: campaign.length,
      unlockedCount: s.unlockedCount,
      solved: s.campaignSolved,
      records: s.campaignRecords,
      stashed: s.campaignMachines
        .map((x, i) => (x ? i : -1))
        .filter((i) => i >= 0),
      last: s.campaignLast,
    },
    extras: {
      count: extras.length,
      solved: s.extrasSolved,
      records: s.extrasRecords,
      stashed: s.extrasMachines
        .map((x, i) => (x ? i : -1))
        .filter((i) => i >= 0),
      last: s.extrasLast,
    },
    challenge: s.challenge
      ? {
          ...s.challenge,
          source: s.challengeRef?.mode ?? "custom",
          index: s.challengeRef?.index ?? null,
        }
      : null,
    editor: {
      parts: s.editor.parts,
      cost: cost(s.editor.parts),
      period: period(s.editor.parts),
      selected: s.editor.selected,
      focus: s.editor.focus,
      cursor: s.editor.cursor,
      drag: s.editor.drag
        ? s.editor.drag.kind === "place"
          ? {
              kind: "place",
              part: s.editor.drag.part,
              index: s.editor.drag.index,
              rotation: s.editor.drag.rotation,
              length: s.editor.drag.length,
              at: s.editor.drag.at,
            }
          : s.editor.drag.kind === "move"
            ? {
                kind: "move",
                part: s.editor.drag.part,
                from: s.editor.drag.from,
                at: s.editor.drag.at,
              }
            : { kind: "lay", part: s.editor.drag.part, end: s.editor.drag.end }
        : null,
      undoDepth: s.editor.undo.length,
      redoDepth: s.editor.redo.length,
    },
    sim: s.sim
      ? {
          status: s.sim.status,
          cycle: s.sim.cycle,
          fraction: s.sim.fraction,
          speed: s.sim.speed,
          motes: s.sim.motes.map((m) => ({ ...m, ...visualMote(s, m) })),
          filaments: s.sim.filaments,
          poses: s.sim.poses,
          grips: s.sim.grips,
          tallies: s.sim.tallies,
          area: s.sim.areaHexes.length,
          fault: s.sim.fault,
          metrics: s.sim.metrics,
        }
      : null,
    pointer: s.pointer,
    completion: s.completion,
    muted: s.muted,
    simTime: s.simTime,
  }),
};
export type OrreryDebugApi = typeof debug;
export const game: Game<OrreryState, OrreryDebugApi> = {
  async initialize(api: InitApi<OrreryState>) {
    for (const a of C.ACTIONS)
      api.input.register(a, { keys: [...C.BINDINGS[a]] });
    const paths = [
      ...Object.values(C.MOTE_SPRITE_PATHS),
      ...Object.values(C.FILAMENT_SPRITE_PATHS),
      ...Object.values(C.SIGIL_GLYPH_PATHS),
      ...Object.values(C.INSTRUCTION_GLYPH_PATHS),
      ...Object.values(C.HUB_PATHS),
      ...Object.values(C.GRIPPER_PATHS),
      C.WHEEL_HUB_PATH,
      C.FIXTURE_MOUNT_PATH,
      ...Object.values(C.APERTURE_SHEETS).flatMap((dir) =>
        Array.from({ length: C.APERTURE_FRAMES }, (_, i) => `${dir}/${i}.png`),
      ),
    ];
    await Promise.all(
      paths.map(async (p) => images.set(p, await api.assets.loadImage(p))),
    );
    await Promise.all(
      Object.entries(C.CUE_PATHS).map(([cue, path]) =>
        api.audio.load(cue, path),
      ),
    );
    await Promise.all(
      Object.entries(C.PARTICLE_PATHS).map(async ([name, path]) =>
        particleSystems.set(
          name,
          JSON.parse(
            await (await api.assets.load(path)).text(),
          ) as ParticleSystem,
        ),
      ),
    );
    for (const [name, read] of Object.entries({
      screen: (s: DeepReadonly<OrreryState>) => s.screen,
      mode: (s: DeepReadonly<OrreryState>) => s.mode,
      challenge: (s: DeepReadonly<OrreryState>) => s.challenge?.name ?? "-",
      source: (s: DeepReadonly<OrreryState>) =>
        s.challengeRef?.mode ?? (s.challenge ? "custom" : "-"),
      parts: (s: DeepReadonly<OrreryState>) => s.editor.parts.length,
      cost: (s: DeepReadonly<OrreryState>) => cost(s.editor.parts),
      period: (s: DeepReadonly<OrreryState>) => period(s.editor.parts),
      status: (s: DeepReadonly<OrreryState>) => s.sim?.status ?? "-",
      cycle: (s: DeepReadonly<OrreryState>) => s.sim?.cycle ?? 0,
      fraction: (s: DeepReadonly<OrreryState>) =>
        s.sim?.fraction.toFixed(3) ?? "-",
      speed: (s: DeepReadonly<OrreryState>) =>
        s.sim ? C.SPEEDS[s.sim.speed] : "-",
      tallies: (s: DeepReadonly<OrreryState>) =>
        s.sim?.tallies
          .map((v) => `${v}/${s.challenge?.target ?? 0}`)
          .join(" ") ?? "-",
      motes: (s: DeepReadonly<OrreryState>) => s.sim?.motes.length ?? 0,
      area: (s: DeepReadonly<OrreryState>) => s.sim?.areaHexes.length ?? 0,
      fault: (s: DeepReadonly<OrreryState>) => s.sim?.fault?.kind ?? "-",
      pointer: (s: DeepReadonly<OrreryState>) =>
        `${s.pointer.x.toFixed(0)},${s.pointer.y.toFixed(0)}`,
      focus: (s: DeepReadonly<OrreryState>) => s.editor.focus,
    }))
      api.diagnostics.register(name, read);
    return [fresh(), debug];
  },
  update(state: DeepReadonly<OrreryState>, api: UpdateApi, dt: number) {
    let s = state as OrreryState;
    const was = s.sim?.status,
      oldParts = s.editor.parts.length,
      oldTally = s.sim?.tallies.reduce((a, b) => a + b, 0) ?? 0;
    s = { ...s, simTime: s.simTime + dt };
    if (!api.audio.looping(C.CUES.music)) api.audio.loop(C.CUES.music);
    for (const a of C.ACTIONS)
      if (api.input.pressed(a)) {
        if (a === "mute") api.audio.setMuted(!api.audio.muted());
        else s = keyboard(s, a);
      }
    for (const sample of api.input.pointerSamples())
      if (sample.primary) s = pointerEvent(s, sample.type, sample.x, sample.y);
    if (s.sim?.status === "running") {
      let rem = s.sim.fraction + C.SPEEDS[s.sim.speed] * dt,
        guard = 0;
      while (s.sim?.status === "running" && guard++ < 1000) {
        const predicted = oneCycle(s);
        if (
          predicted.sim?.status === "faulted" &&
          predicted.sim.fraction <= rem
        ) {
          s = predicted;
          break;
        }
        if (rem < 1) {
          s = { ...s, sim: { ...s.sim, fraction: rem } };
          break;
        }
        s = predicted;
        rem -= 1;
      }
    }
    const frameCues = new Set<C.CueName>(pendingPointerCues);
    pendingPointerCues.clear();
    if (oldParts !== s.editor.parts.length)
      frameCues.add(
        oldParts < s.editor.parts.length ? C.CUES.place : C.CUES.erase,
      );
    if (!was && s.sim) frameCues.add(C.CUES.start);
    if ((s.sim?.tallies.reduce((a, b) => a + b, 0) ?? 0) > oldTally)
      frameCues.add(C.CUES.constellation);
    if (was !== "faulted" && s.sim?.status === "faulted")
      frameCues.add(C.CUES.halt);
    if (was !== "complete" && s.sim?.status === "complete")
      frameCues.add(C.CUES.complete);
    for (const cue of frameCues) api.audio.play(cue);
    return { ...s, muted: api.audio.muted() };
  },
  render(state: DeepReadonly<OrreryState>, api: RenderApi) {
    render(state, api.ctx);
  },
};

/** Deterministic rules entry points used by the in-process tests. */
export const orreryCore = {
  fresh,
  open,
  pointerEvent,
  keyboard,
  oneCycle,
  start,
  reference,
  loadSolution: debug.loadSolution,
};
