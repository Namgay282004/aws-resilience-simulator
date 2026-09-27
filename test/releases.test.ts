import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDraft, serializeDraft, migrateDraft } from '../src/engine/persistence/draft.ts';
import { isNewRelease, saveUpdateRecovery, UPDATE_RECOVERY_KEY } from '../src/engine/releases/release.ts';
const fixture = readFileSync(new URL('./fixtures/draft-v1.json', import.meta.url), 'utf8');
test('Historical v1 draft retains every workspace field through v2 export/import', () => {
  const original = JSON.parse(fixture);
  const state = parseDraft(fixture);
  assert.deepEqual(state, original.state);
  const exported = serializeDraft(state);
  assert.equal(JSON.parse(exported).version, 2);
  assert.deepEqual(parseDraft(exported), original.state);
  migrateDraft(original);
  assert.equal(original.version, 1, 'migration must not mutate source');
  assert.throws(() => parseDraft(JSON.stringify({ ...original, version: 999 })), /Unsupported/);
  assert.throws(() => parseDraft(JSON.stringify({ ...original, state: {} })), /Invalid/);
});
test('Release detection isolates channels and rejects malformed or incompatible manifests', () => {
  const current = { version: '1.0.0', buildId: 'old', channel: 'stable', builtAt: '', draftVersion: 2 };
  assert.equal(isNewRelease({ ...current, buildId: 'new' }, current), true);
  assert.equal(isNewRelease(current, current), false);
  assert.equal(isNewRelease({ ...current, buildId: 'new', channel: 'preview' }, current), false);
  assert.equal(isNewRelease({ ...current, buildId: 'new', draftVersion: 3 }, current), false);
  assert.equal(isNewRelease(null, current), false);
});
test('Recovery save verifies exact data, preserves normal draft slot and surfaces storage failures', () => {
  const map = new Map<string, string>();
  const storage = { setItem: (key: string, value: string) => { map.set(key, value); }, getItem: (key: string) => map.get(key) ?? null };
  saveUpdateRecovery(storage, fixture);
  assert.equal(map.get(UPDATE_RECOVERY_KEY), fixture);
  assert.equal(map.size, 1);
  assert.throws(() => saveUpdateRecovery({ setItem: () => { throw new Error('quota'); }, getItem: () => null }, fixture), /quota/);
  assert.throws(() => saveUpdateRecovery({ setItem: () => {}, getItem: () => null }, fixture), /verify/);
});

test('Named drafts preserve their name and produce safe JSON filenames', async () => {
  const { draftFilename } = await import('../src/engine/persistence/draft.ts');
  const state = { ...parseDraft(fixture), draftName: 'Lab 3 networking' };
  assert.equal(parseDraft(serializeDraft(state)).draftName, 'Lab 3 networking');
  assert.equal(draftFilename(state.draftName), 'Lab 3 networking.json');
  assert.equal(draftFilename('Lab.json'), 'Lab.json');
  assert.equal(draftFilename('  '), 'Untitled draft.json');
  assert.equal(draftFilename('Lab/3:network'), 'Lab-3-network.json');
});
