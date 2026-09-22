import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const release = {
  version: JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version,
  buildId: process.env.RELEASE_ID || randomUUID(),
  channel: process.env.RELEASE_CHANNEL || (process.env.AWS_BRANCH === 'main' ? 'stable' : 'preview'),
  builtAt: new Date().toISOString(),
  draftVersion: 2
};
if (!['stable', 'preview'].includes(release.channel)) throw new Error('RELEASE_CHANNEL must be stable or preview');
export default defineConfig({
  define: { __APP_RELEASE__: JSON.stringify(release) },
  plugins: [react(), { name: 'release-manifest', generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'release.json', source: JSON.stringify(release) });
  } }],
  server: { port: 5173, host: true }
});
