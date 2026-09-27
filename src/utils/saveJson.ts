/** User-initiated file save; no access to the repository or arbitrary folders is implied. */
export async function saveJsonFile(text: string, filename: string, chooseLocation: boolean): Promise<boolean> {
  try {
    if (chooseLocation && typeof (window as any).showSaveFilePicker === 'function') {
      const handle = await (window as any).showSaveFilePicker({ suggestedName: filename, types: [{ description: 'JSON file', accept: { 'application/json': ['.json'] } }] });
      const writable = await handle.createWritable();
      await writable.write(text); await writable.close();
    } else {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    return true;
  } catch (error) { if ((error as Error)?.name === 'AbortError') return false; throw error; }
}
