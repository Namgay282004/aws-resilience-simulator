# Lab reference source files

Each `.json` file is one complete `LabReference` (see `../courseLabShared.ts`): id, title,
description, expected outcome, optional simulation scope, nodes/edges/scenario, and optionally
`configurationChecks` and/or an `authorization` block for policy-only labs.

Course-lab metadata (which labs exist, their objectives, source URL, limitations, and which
reference IDs belong to which lab) lives separately in `../courseLabsMeta.json` - it isn't part
of this folder because it isn't architecture data a student edits on the canvas.

## Edit or add a lab reference

1. In the app, open **Labs**, pick a lab, and click the small download icon next to any reference
   card to get its current JSON.
2. Edit the file (or build a variant on the canvas and download an existing reference as a
   starting point). Keep its `id` unique across every file in this folder.
3. Place the file in this folder (`src/data/labs/`), named `NN-<id>.json` (two-digit lab number
   prefix keeps files grouped in listings; the prefix itself isn't read by anything).
4. If this is a *new* lab reference (not editing an existing one), add its `id` to the matching
   lab's `referenceIds` array in `../courseLabsMeta.json`.
5. Restart `npm run dev`, run `npm run build`, or run `npm run labs:sync` if the dev server is
   already running. The catalogue is regenerated automatically before dev/build/test.
6. Run `npm test` - `test/course-labs.test.ts` exercises every lab reference (unique IDs, valid
   graph, deterministic simulation outcome, subnet placement, and more).

There is no in-app upload/import for lab references (unlike a regular architecture reference,
these carry configuration checks and IAM authorization data that need reviewing, not just
re-uploading) - editing the file and placing it here is the only path to a permanent change.

`../labsRegistry.ts` is generated; do not edit it. `../courseLabs.ts` assembles `COURSE_LABS` by
looking up each lab's `referenceIds` (from `courseLabsMeta.json`) against every file in this
folder - a referenced ID with no matching file throws at import time rather than silently
dropping that lab reference.

Migration: this folder replaced generator functions in `courseLabs.ts`/the retired
`courseLabsAdvanced.ts` that produced these objects programmatically. Every file here was written
by running that code once and dumping its exact output - `npm test` passing unchanged (469/469,
same as before the migration) is the evidence nothing was lost.
