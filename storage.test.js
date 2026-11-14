import test from "node:test";
import assert from "node:assert/strict";
import { KEY, readStore, writeStore, recoverStore } from "./storage.js";
function fixture() {
  const values = new Map();
  return {
    storage: {
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => values.set(k, v),
    },
    locks: { request: async (_, fn) => fn() },
  };
}
const item = {
  id: "one",
  title: "Reply",
  shortcut: "",
  category: "",
  body: "Hi",
};
test("stale drafts cannot overwrite newer saved revisions", async () => {
  const env = fixture();
  await writeStore(0, (current) => ({ ...current, snippets: [item] }), env);
  await assert.rejects(
    writeStore(0, () => ({ version: 1, snippets: [] }), env),
    /another tab/,
  );
  assert.equal(readStore(env.storage).snippets.length, 1);
});
test("quota failure does not mutate previous library", async () => {
  const env = fixture();
  await writeStore(0, (current) => ({ ...current, snippets: [item] }), env);
  env.storage.setItem = () => {
    throw Error("Quota exceeded");
  };
  await assert.rejects(
    writeStore(1, () => ({ version: 1, snippets: [] }), env),
    /Quota/,
  );
  assert.equal(readStore(env.storage).snippets.length, 1);
});
test("corrupt storage requires explicit recovery and exact raw comparison", async () => {
  const env = fixture();
  env.storage.setItem(KEY, "broken");
  await assert.rejects(
    writeStore(0, () => ({ version: 1, snippets: [] }), env),
  );
  await assert.rejects(
    recoverStore("different", { version: 1, snippets: [] }, env),
    /changed/,
  );
  await recoverStore("broken", { version: 1, snippets: [item] }, env);
  assert.equal(readStore(env.storage).snippets.length, 1);
});
test("unsupported locking refuses unsafe writes", async () => {
  await assert.rejects(
    writeStore(0, () => ({ version: 1, snippets: [] }), {
      storage: fixture().storage,
      locks: null,
    }),
    /locking/,
  );
});
