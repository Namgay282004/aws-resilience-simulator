# Save and resume drafts

Open **Drafts** in the header:

- **Save draft** stores one manual snapshot in this browser for this site.
- **Resume draft** restores that snapshot after confirming replacement of current work.
- **Export draft JSON** downloads a portable, versioned snapshot.
- **Import draft JSON** restores a compatible snapshot after validation and confirmation.

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
