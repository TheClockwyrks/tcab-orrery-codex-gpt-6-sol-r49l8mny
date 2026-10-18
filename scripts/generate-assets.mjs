/* global Buffer */
import { createCanvas } from "@napi-rs/canvas";
import fs from "node:fs";
import path from "node:path";
const root = "assets";
const save = (p, canvas) => {
  const f = path.join(root, p);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, canvas.toBuffer("image/png"));
};
const canvas = (w, h) => {
  const c = createCanvas(w, h);
  return [c, c.getContext("2d")];
};
const ring = (g, x, y, r, color, width = 2) => {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.strokeStyle = color;
  g.lineWidth = width;
  g.stroke();
};
const line = (g, x, y, X, Y, color, w = 2) => {
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(X, Y);
  g.strokeStyle = color;
  g.lineWidth = w;
  g.stroke();
};
const star = (g, x, y, r, n, color) => {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n,
      R = i % 2 ? r * 0.45 : r;
    const X = x + Math.cos(a) * R,
      Y = y + Math.sin(a) * R;
    if (i === 0) g.moveTo(X, Y);
    else g.lineTo(X, Y);
  }
  g.closePath();
  g.fillStyle = color;
  g.fill();
};
const colors = [
  "#c6b68f",
  "#9ed5d1",
  "#86c7de",
  "#ffb66f",
  "#d6a5a2",
  "#a6c5bf",
  "#cdb782",
  "#aab9d7",
  "#c88062",
  "#e9ce92",
  "#e4e7ee",
  "#ffd991",
  "#5d688c",
  "#d1f6e5",
  "#c5c3eb",
];
const motes = [
  "dust",
  "nebula",
  "comet",
  "nova",
  "meteor",
  "mercury",
  "saturn",
  "jupiter",
  "mars",
  "venus",
  "luna",
  "sol",
  "umbra",
  "lumen",
  "aether",
];
for (let i = 0; i < motes.length; i++) {
  const [c, g] = canvas(44, 44),
    color = colors[i];
  const glow = g.createRadialGradient(22, 22, 2, 22, 22, 21);
  glow.addColorStop(0, color);
  glow.addColorStop(0.55, color + "c0");
  glow.addColorStop(1, color + "00");
  g.fillStyle = glow;
  g.fillRect(0, 0, 44, 44);
  g.shadowColor = color;
  g.shadowBlur = 5;
  g.beginPath();
  g.arc(22, 22, 8 + (i % 4), 0, 7);
  g.fillStyle = "#13232e";
  g.fill();
  ring(g, 22, 22, 8 + (i % 4), color, 2);
  g.shadowBlur = 0;
  if (i === 0) {
    for (let j = 0; j < 6; j++)
      star(g, 14 + ((j * 11) % 18), 13 + ((j * 7) % 18), 2, 4, color);
  } else if (i >= 5 && i <= 11) {
    ring(g, 22, 22, 12 + (i - 5) * 0.65, color, 1);
    g.beginPath();
    g.ellipse(22, 22, 18, 6, (i - 5) * 0.28, 0, 7);
    g.strokeStyle = color;
    g.lineWidth = 1.5;
    g.stroke();
    star(g, 22, 22, 5, 6, color);
  } else if (i === 12) {
    g.fillStyle = "#07101c";
    g.beginPath();
    g.arc(22, 22, 8, 0, 7);
    g.fill();
    ring(g, 22, 22, 14, color, 2);
  } else if (i === 13) {
    star(g, 22, 22, 14, 8, color);
    ring(g, 22, 22, 18, color, 1);
  } else if (i === 14) {
    for (let j = 0; j < 4; j++) ring(g, 22, 22, 8 + j * 3, colors[1 + j], 1);
  } else {
    star(g, 22, 22, 12, 5, color);
    ring(g, 22, 22, 17, color, 1);
  }
  save(`sprites/motes/${motes[i]}.png`, c);
}
for (const [name, heavy] of [
  ["plain", false],
  ["triune", true],
]) {
  const [c, g] = canvas(48, 16);
  for (let j = 0; j < (heavy ? 3 : 1); j++) {
    line(
      g,
      1,
      8 + (j - 1) * (heavy ? 4 : 0),
      47,
      8 + (j - 1) * (heavy ? 4 : 0),
      heavy ? "#f3d798" : "#87b9ba",
      heavy ? 2 : 2,
    );
  }
  for (const x of [6, 24, 42]) {
    g.fillStyle = heavy ? "#fff0c0" : "#b5dad7";
    g.beginPath();
    g.arc(x, 8, heavy ? 3 : 2, 0, 7);
    g.fill();
  }
  save(`sprites/filaments/${name}.png`, c);
}
const sigils = [
  "bind",
  "manifold",
  "triune",
  "sunder",
  "wane",
  "mirror",
  "ascend",
  "conjoin",
  "eclipse",
  "confluence",
  "dispersion",
  "void",
];
for (let i = 0; i < sigils.length; i++) {
  const [c, g] = canvas(48, 48);
  ring(g, 24, 24, 18, "#7d6746", 2);
  ring(g, 24, 24, 14, "#b5985e", 1);
  const n = 3 + (i % 6);
  for (let j = 0; j < n; j++) {
    const a = (2 * Math.PI * j) / n + i * 0.18;
    const x = 24 + 13 * Math.cos(a),
      y = 24 + 13 * Math.sin(a);
    line(g, 24, 24, x, y, i % 3 === 0 ? "#8dcfd0" : "#e0bd79", 1.5);
    g.fillStyle = "#f7dba0";
    g.beginPath();
    g.arc(x, y, 2, 0, 7);
    g.fill();
  }
  star(g, 24, 24, 4 + (i % 3), 4 + (i % 4), "#f1d59a");
  save(`sprites/sigils/${sigils[i]}.png`, c);
}
const instructions = [
  "grab",
  "drop",
  "rotate-cw",
  "rotate-ccw",
  "pivot-cw",
  "pivot-ccw",
  "extend",
  "retract",
  "advance",
  "recede",
];
for (let i = 0; i < instructions.length; i++) {
  const [c, g] = canvas(24, 24);
  ring(g, 12, 12, 10, "#b09462", 1);
  if (i < 2) {
    ring(g, 12, 12, i === 0 ? 4 : 7, "#e7d197", 2);
    for (const x of [6, 18]) line(g, x, 7, x, 17, "#e7d197", 2);
  } else if (i < 6) {
    g.beginPath();
    g.arc(12, 12, 6, i % 2 ? -0.8 : 0.8, i % 2 ? 4.2 : 5.4, i % 2 === 1);
    g.strokeStyle = "#e7d197";
    g.lineWidth = 2;
    g.stroke();
    star(g, i % 2 ? 7 : 17, 6, 3, 3, "#e7d197");
    if (i >= 4) ring(g, 12, 12, 2, "#8fd4cf");
  } else {
    const sign = i % 2 ? 1 : -1;
    line(g, 12, 4, 12, 20, "#e7d197", 2);
    line(
      g,
      12,
      4 + (sign > 0 ? 0 : 16),
      7,
      10 + (sign > 0 ? 0 : 5),
      "#e7d197",
      2,
    );
    line(
      g,
      12,
      4 + (sign > 0 ? 0 : 16),
      17,
      10 + (sign > 0 ? 0 : 5),
      "#e7d197",
      2,
    );
  }
  save(`sprites/instructions/${instructions[i]}.png`, c);
}
for (const name of [
  "hub-arm",
  "hub-piston",
  "gripper-open",
  "gripper-closed",
  "wheel-hub",
  "fixture-mount",
]) {
  const size = name.startsWith("gripper")
      ? 32
      : name.startsWith("hub")
        ? 40
        : 48,
    [c, g] = canvas(size, size),
    h = size / 2;
  ring(g, h, h, h - 4, "#ae8c55", 3);
  ring(g, h, h, h - 8, "#e5c783", 2);
  if (name === "hub-piston") {
    for (let i = 0; i < 6; i++)
      line(
        g,
        h,
        h,
        h + (h - 7) * Math.cos((i * Math.PI) / 3),
        h + (h - 7) * Math.sin((i * Math.PI) / 3),
        "#85c7c7",
        2,
      );
  } else if (name === "wheel-hub") {
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      line(
        g,
        h + (h - 11) * Math.cos(a),
        h + (h - 11) * Math.sin(a),
        h + (h - 5) * Math.cos(a),
        h + (h - 5) * Math.sin(a),
        "#e5c783",
        2,
      );
    }
  } else if (name.startsWith("gripper")) {
    line(g, 6, 6, 11, name === "gripper-closed" ? 16 : 10, "#f5d99b", 3);
    line(g, 26, 6, 21, name === "gripper-closed" ? 16 : 10, "#f5d99b", 3);
    line(g, 11, 18, 21, 18, "#90cbc9", 2);
  } else star(g, h, h, h * 0.48, 8, "#b8d8d0");
  ring(g, h, h, 4, "#ffebad", 2);
  save(`sprites/parts/${name}.png`, c);
}
for (const kind of ["rise", "set"])
  for (let frame = 0; frame < 6; frame++) {
    const [c, g] = canvas(48, 48),
      cx = 24,
      cy = 24;
    ring(g, cx, cy, 19, kind === "rise" ? "#70d1ca" : "#e7b475", 2);
    for (let j = 0; j < 6; j++) {
      const a = ((j + frame / 6) * Math.PI) / 3,
        rr = kind === "rise" ? 15 : 11;
      star(
        g,
        cx + rr * Math.cos(a),
        cy + rr * Math.sin(a),
        3,
        4,
        kind === "rise" ? "#c4ffff" : "#ffe5ae",
      );
    }
    ring(
      g,
      cx,
      cy,
      kind === "rise" ? 7 : 10,
      kind === "rise" ? "#8de1df" : "#f8cf87",
      2,
    );
    star(
      g,
      cx,
      cy,
      kind === "rise" ? 4 : 6,
      6,
      kind === "rise" ? "#bff5f0" : "#ffdeaa",
    );
    save(`sprites/apertures/${kind}/${frame}.png`, c);
  }
const wav = (file, notes, duration) => {
  const sr = 22050,
    N = Math.floor(sr * duration),
    data = Buffer.alloc(44 + N * 2);
  data.write("RIFF", 0);
  data.writeUInt32LE(data.length - 8, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(sr, 24);
  data.writeUInt32LE(sr * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(N * 2, 40);
  for (let i = 0; i < N; i++) {
    const t = i / sr;
    let v = 0;
    for (const n of notes) {
      const u = t - n.t;
      if (u >= 0 && u < n.d) {
        const env = Math.sin((Math.PI * u) / n.d) ** 1.5;
        v +=
          Math.sin(2 * Math.PI * n.f * u) * env * n.a +
          Math.sin(4 * Math.PI * n.f * u) * env * n.a * 0.14;
      }
    }
    data.writeInt16LE(
      Math.round(Math.max(-0.95, Math.min(0.95, v)) * 32767),
      44 + i * 2,
    );
  }
  fs.writeFileSync(`assets/audio/${file}.wav`, data);
};
const themes = {
  place: [
    [660, 0, 0.1, 0.22],
    [990, 0.03, 0.08, 0.12],
  ],
  erase: [
    [440, 0, 0.13, 0.18],
    [330, 0.04, 0.12, 0.12],
  ],
  start: [
    [220, 0, 0.38, 0.13],
    [330, 0.1, 0.33, 0.15],
    [440, 0.2, 0.25, 0.13],
  ],
  halt: [
    [300, 0, 0.32, 0.24],
    [185, 0.1, 0.38, 0.18],
  ],
  constellation: [
    [587, 0, 0.24, 0.15],
    [880, 0.08, 0.28, 0.14],
  ],
  complete: [
    [392, 0, 0.65, 0.14],
    [494, 0.15, 0.65, 0.14],
    [587, 0.3, 0.65, 0.14],
    [784, 0.45, 0.7, 0.16],
  ],
};
for (const [name, rows] of Object.entries(themes))
  wav(
    name,
    rows.map(([f, t, d, a]) => ({ f, t, d, a })),
    Math.max(...rows.map((r) => r[1] + r[2])) + 0.05,
  );
const melody = [
  196, 247, 294, 392, 330, 294, 247, 196, 220, 262, 330, 440, 392, 330, 262,
  220,
];
const notes = [];
for (let k = 0; k < 4; k++)
  for (let j = 0; j < melody.length; j++) {
    const t = (k * 16 + j) * 0.5;
    notes.push(
      { f: melody[j], t, d: 0.44, a: 0.047 },
      { f: melody[j] / 2, t, d: 0.48, a: 0.031 },
    );
  }
wav("music", notes, 32);
const varlen = (n) => {
  const a = [n & 127];
  while (n > 127) {
    n >>= 7;
    a.unshift(128 | (n & 127));
  }
  return a;
};
const ev = [];
let last = 0;
for (const n of notes.filter((_, i) => i % 2 === 0)) {
  const at = Math.round(n.t * 960),
    off = Math.round((n.t + n.d) * 960);
  ev.push(
    [at, [0x90, Math.round(69 + 12 * Math.log2(n.f / 440)), 70]],
    [off, [0x80, Math.round(69 + 12 * Math.log2(n.f / 440)), 0]],
  );
}
ev.sort((a, b) => a[0] - b[0]);
const track = [];
for (const [at, msg] of ev) {
  track.push(...varlen(at - last), ...msg);
  last = at;
}
track.push(0, 255, 47, 0);
const head = Buffer.from([77, 84, 104, 100, 0, 0, 0, 6, 0, 0, 0, 1, 1, 224]);
const th = Buffer.alloc(8);
th.write("MTrk", 0);
th.writeUInt32BE(track.length, 4);
fs.writeFileSync(
  "assets/audio/music.mid",
  Buffer.concat([head, th, Buffer.from(track)]),
);
