export interface Release { version: string; buildId: string; channel: string; builtAt: string; draftVersion: number }
declare const __APP_RELEASE__: Release;
export const CURRENT_RELEASE: Release = typeof __APP_RELEASE__ === 'undefined'
  ? { version: 'development', buildId: 'development', channel: 'preview', builtAt: '', draftVersion: 2 }
  : __APP_RELEASE__;
export function isNewRelease(value: unknown, current = CURRENT_RELEASE): value is Release {
  const candidate = value as Release | null;
  return !!candidate && typeof candidate.version === 'string' && typeof candidate.buildId === 'string' &&
    candidate.buildId.length > 0 && candidate.channel === current.channel && candidate.buildId !== current.buildId &&
    Number.isInteger(candidate.draftVersion) && candidate.draftVersion === current.draftVersion;
}
export const UPDATE_RECOVERY_KEY = 'aws-architecture-lab.update-recovery';
export function saveUpdateRecovery(storage: Pick<Storage, 'setItem' | 'getItem'>, text: string) {
  storage.setItem(UPDATE_RECOVERY_KEY, text);
  if (storage.getItem(UPDATE_RECOVERY_KEY) !== text) throw new Error('Could not verify saved work. Export a JSON backup before reloading.');
}
