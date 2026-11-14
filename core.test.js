import test from "node:test";
import assert from "node:assert/strict";
import { variables, expand, parseBackup, merge, search } from "./core.js";
const item = {
  id: "one",
  title: "Reply",
  shortcut: ";reply",
  category: "Support",
  body: "Hi {{name}}, {{name}}!",
};
const backup = { version: 1, snippets: [item] };
test("variables deduplicate and replace literal values without executing markup", () => {
  assert.deepEqual(variables(item.body), ["name"]);
  assert.equal(
    expand(item.body, { name: "$&<img onerror=alert(1)>" }),
    "Hi $&<img onerror=alert(1)>, $&<img onerror=alert(1)>!",
  );
});
test("missing and inherited variable values are rejected", () => {
  assert.throws(() => expand("{{constructor}}", {}), /Fill in/);
  assert.throws(() => expand("{{name}}", { name: "  " }), /Fill in/);
});
test("invalid variable syntax is rejected", () => {
  for (const body of ["{{bad name}}", "{{__proto__}}", "{{name", "name}}"])
    assert.throws(() => variables(body));
});
test("imports validate every item before returning", () => {
  assert.throws(() =>
    parseBackup(
      JSON.stringify({
        version: 1,
        snippets: [item, { ...item, id: "two", body: 123 }],
      }),
    ),
  );
  assert.throws(() => parseBackup("{broken"));
  assert.throws(() =>
    parseBackup(JSON.stringify({ version: 2, snippets: [] })),
  );
});
test("duplicate IDs and oversize backups are rejected", () => {
  assert.throws(
    () => parseBackup(JSON.stringify({ version: 1, snippets: [item, item] })),
    /Duplicate/,
  );
  assert.throws(() => parseBackup(" ".repeat(2 * 1024 * 1024 + 1)), /2 MB/);
});
test("merge deduplicates identical records and rejects conflicting versions", () => {
  assert.equal(merge(backup, backup).snippets.length, 1);
  assert.throws(
    () =>
      merge(backup, { version: 1, snippets: [{ ...item, title: "Changed" }] }),
    /different version/,
  );
});
test("search combines words with collection filter", () => {
  assert.equal(search([item], "reply name", "Support").length, 1);
  assert.equal(search([item], "reply", "Work").length, 0);
});
