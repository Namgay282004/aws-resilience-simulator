# Reference diagram source files

Each `.json` file is one complete `ReferenceArchitecture`: metadata, nodes (including
boundaries and service configuration), edges, and optionally a request scenario.

## Add your own diagram

1. Build the architecture on the canvas.
2. Open **Reference Diagrams** at the top-left of the canvas.
3. Enter a name and click **Save as reference**. Save/download the reference JSON file.
4. Place that file in this folder (`src/data/references/`). Keep its unique `id`.
5. Restart `npm run dev`, run `npm run build`, or run `npm run references:sync` if the dev
   server is already running. The catalogue is regenerated automatically before dev/build/test.
6. Run `npm test` to validate the reference and existing scenarios before publishing it.

Do not use Export's workspace draft JSON here: that format includes the whole workspace,
whereas Save as reference writes the diagram format used by this folder.

`../referenceRegistry.ts` is generated; do not edit it. `../referenceArchitectures.ts`
keeps the existing import API compatible. Files are loaded in filename order. Built-in
files have numeric prefixes to preserve their existing display order. IDs must be unique.

The browser cannot silently write into the repository. Save as reference also attempts
to keep a copy in browser storage, but the exported file is the portable source artifact.
After deployment, new source references appear for students when they load the new release.

Migration: all 14 built-in reference snapshots were compared against the old fully
initialized catalogue before replacing it; graph/configuration contents were identical.
