# Save and resume drafts

Open **Export** in the header:

- **Save draft** stores one manual snapshot in this browser for this site.
- **Resume draft** restores that snapshot after confirming replacement of current work.
- **Download JSON** downloads a portable, versioned snapshot.
- **Upload JSON** restores a compatible snapshot after validation and confirmation.

Saved state includes nodes and their complete configuration, edges, layout and boundary sizes,
network identities, scenario, simulation result and playback position/speed, active failures,
lab reference, challenge ID/result, app mode, selections, task-flow setting, NACL column visibility,
and canvas pan/zoom. Derived analysis and cost are recalculated. Challenges reattach their
executable evaluator from the installed challenge catalog, rather than trying to serialize code.

Restored simulation playback is paused. Transient hover, open dialogs, palette search/collapse,
and uncommitted form text are not saved. Commit edits before saving. This is manual saving,
not autosave; browser data can be cleared. Keep JSON backups for portability and long-term retention.
One browser save replaces the previous save after confirmation; downloaded files can retain
multiple versions. Storage/read/import failures are displayed without intentionally clearing work.

Format: `aws-architecture-lab`, version 2. Version 1 drafts migrate without changing workspace state. Imports reject unsupported versions, malformed
workspace structure, duplicate IDs, dangling edges and invalid playback positions. Maximum
import size is 20 MB. JSON exports are not encrypted and contain the resource configuration
entered into the simulator. Unknown challenge IDs are rejected before restoring state.

Verification: provider integration test exports a configured running workspace, clears it,
imports it and verifies scenario, failure, simulation result, viewport and paused playback.
Malformed/unsupported imports leave existing state unchanged. Full regression suite and
production build pass.


## Named drafts

Open **Export** and edit **Draft name**. Browser saves, JSON downloads, and update recovery
retain this name. Older unnamed drafts open as “Untitled draft”. Use **Download JSON** and **Upload JSON** inside Export for files. A draft named “Lab 3” downloads
as “Lab 3.json”; filesystem-unsafe characters are replaced with hyphens. A trailing .json
is not duplicated. Renaming does not change files already downloaded or create extra browser
save slots. Save again to persist a rename in the browser.

## Save location and compact navigation

Export now owns the JSON workflow, replacing the old audit/topology-only export modal.
Downloads contain the complete versioned draft, including boundary geometry and runtime.
The header no longer shows separate Drafts/Download JSON/Upload JSON controls. Image export
remains available separately. The AWS Cloud watermark was removed from the canvas.

When supported, “Choose folder and filename…” opens the browser save-file picker. Otherwise
use the browser download location; browser settings control whether it asks for a folder.
The application cannot silently set a filesystem path. Picker cancellation leaves work intact.
Source: https://developer.mozilla.org/en-US/docs/Web/API/Window/showSaveFilePicker

## Export dialog design

Export uses a light, focused dialog with separate JSON-file and browser-draft sections,
a filename preview, primary Download action, secondary Upload action, and save-location choice.
Keyboard focus stays within the dialog; Escape closes and returns focus to the invoking control.
Reference diagrams are a different format: use the canvas Reference Diagrams → Save as reference.
