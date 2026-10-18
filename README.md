# Orrery

Orrery is a browser puzzle about building celestial machines. Place rises and sets on a hex field, arrange arms and sigils, write an instruction tape, and run the machine until it delivers each requested constellation six times. The Campaign advances through eight puzzles; Extras is a shelf of ten open challenges.

## Run locally

```sh
npm ci
npm run dev
```

Open the local address Vite prints. To produce a static site, run `npm run build` and serve `dist/` at the root of a static host or under a subpath. The committed files in `assets/` are copied into the build through `public/assets`; asset generation is not part of the build.

## Controls

Use the pointer or touch to choose menus, drag parts from the tray to the field, select parts, and choose tape cells. `Enter` chooses a menu item; arrow keys move through menus or tape cells. In the field, `Q` and `E` rotate a selected part, `W` and `S` change arm reach, and `X` removes it. `U` undoes and `I` redoes an edit.

In a tape cell, `G` grabs, `V` drops, `A` and `D` rotate, `Z` and `C` pivot, `W` and `S` extend or retract, and `T` and `B` advance or recede. `Delete` blanks a cell; `Backspace` erases the previous one. `Space` starts or pauses a run, `N` steps it, `,` and `.` change speed, `Escape` returns to editing or the previous menu, and `M` mutes audio. Press the backtick key for the engine's diagnostic overlay.

The `showcase/` directory contains a recorded play session and stills captured from the running game. `scripts/generate-assets.mjs` documents the one-time art and audio generation used to create the committed files.
