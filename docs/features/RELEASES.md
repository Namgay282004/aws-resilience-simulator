# Classroom releases and safe updates

Each production build emits `release.json` and embeds the same metadata in the application:
package version, unique build ID, stable/preview channel, build timestamp and draft schema version.
The header displays the release. Open tabs check the manifest with no-store every minute and on focus.
Offline/invalid responses leave work untouched. Different channels and incompatible draft schema
versions do not offer automatic reload. A different same-channel build ID includes a rollback.

Save and reload writes and reads back a recovery draft in sessionStorage before reloading.
Storage failure cancels reload. After reload, use **Restore work saved before update**. Recovery
is isolated by browser tab and origin, does not overwrite the ordinary saved draft, and is removed
only after successful restoration. Export JSON before closing a tab if recovery has not completed.
No forced reload occurs.

Draft v2 adds application-release metadata. The v1 migration leaves the workspace unchanged;
the old browser storage key remains readable. Future versions must add explicit migrations and
historical fixtures before increasing the draft schema. Unknown formats/versions fail without
replacing work. Compatibility tests retain a checked-in v1 example.

## Hosting setup still required

1. Connect this repository to AWS Amplify Hosting and enable the `main` and `preview` branches.
   `amplify.yml` installs Node 22, runs tests and builds. Main produces stable releases; all other
   branches produce preview releases. Each branch must have its own URL/origin.
2. Assign your classroom domain only to main. Use the preview URL for teacher testing.
3. Protect main in GitHub: require pull requests and the Verify classroom release check. Promote
   reviewed preview changes by merging into main. These account settings cannot be enabled by
   repository files alone. The workflow verifies and uploads artifacts; Amplify handles deployment.
4. Keep old hashed assets available during deployments when using a custom hosting pipeline.
   Deploy assets before HTML/release manifest and publish HTML/manifest together. Amplify manages
   deployment publication; do not upload individual files to a live origin as a release process.
5. Verify response headers after first deployment: HTML must revalidate, release.json must not
   be stored, and /assets/ fingerprinted files may be cached for a year. customHttp.yml supplies
   Amplify rules; nginx.conf supplies Docker rules. Public files outside /assets/ revalidate.

Local builds default to preview. Set RELEASE_CHANNEL=stable for a classroom build. Optionally
set RELEASE_ID to a unique CI release ID; otherwise each build generates a UUID. Docker defaults
to stable and accepts RELEASE_CHANNEL and RELEASE_ID build arguments. Vite retains hashed asset
filenames. Increment package.json version for meaningful releases; build IDs distinguish rebuilds.

No cloud resources, branches, domains or branch-protection settings are created automatically.
Stable and preview drafts are isolated by origin; use JSON export/import to transfer work.

Sources:
- https://docs.aws.amazon.com/amplify/latest/userguide/setting-custom-headers.html
- https://vite.dev/guide/assets
