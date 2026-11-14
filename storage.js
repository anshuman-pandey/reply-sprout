import { validate, parseBackup, MAX_FILE } from "./core.js";
export const KEY = "snippet-cabinet-v1";
export function readStore(storage = localStorage) {
  const raw = storage.getItem(KEY);
  if (raw === null) return { version: 1, revision: 0, snippets: [] };
  const value = parseBackup(raw);
  const revision = JSON.parse(raw).revision;
  if (!Number.isSafeInteger(revision) || revision < 0)
    throw Error(
      "Saved revision is invalid. Export raw recovery data before replacing the library.",
    );
  return { ...value, revision };
}
export async function writeStore(
  expected,
  change,
  { storage = localStorage, locks = navigator.locks } = {},
) {
  if (!locks)
    throw Error(
      "Safe storage locking is unavailable. Open this app on localhost or HTTPS in a supported browser.",
    );
  return locks.request(KEY, () => {
    const current = readStore(storage);
    if (current.revision !== expected)
      throw Error(
        "The library changed in another tab. Your draft is still here. Copy it before reloading the library.",
      );
    const updated = {
      ...validate(change(current)),
      revision: current.revision + 1,
    };
    const raw = JSON.stringify(updated);
    if (new TextEncoder().encode(raw).length > MAX_FILE)
      throw Error(
        "Library exceeds 2 MB. Export and remove older snippets before adding more.",
      );
    // Quota and permission errors propagate; the caller must retain its draft.
    storage.setItem(KEY, raw);
    return updated;
  });
}
export async function recoverStore(
  expectedRaw,
  incoming,
  { storage = localStorage, locks = navigator.locks } = {},
) {
  if (!locks)
    throw Error("Safe storage locking is unavailable. Use localhost or HTTPS.");
  return locks.request(KEY, () => {
    if (storage.getItem(KEY) !== expectedRaw)
      throw Error(
        "Saved data changed. Export raw data again, then reload before recovery.",
      );
    let broken = false;
    try {
      readStore(storage);
    } catch {
      broken = true;
    }
    if (!broken)
      throw Error("The saved library is readable. Reload it before importing.");
    const updated = { ...validate(incoming), revision: Date.now() };
    const raw = JSON.stringify(updated);
    if (new TextEncoder().encode(raw).length > MAX_FILE)
      throw Error("Library exceeds 2 MB.");
    storage.setItem(KEY, raw);
    return updated;
  });
}
