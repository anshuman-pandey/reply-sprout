export const MAX_ITEMS = 500,
  MAX_BODY = 20000,
  MAX_FILE = 2 * 1024 * 1024;
const token = /\{\{([A-Za-z][A-Za-z0-9_]{0,39})\}\}/g;
function text(value, name, max, required = false) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    throw Error(
      `${name} must be ${required ? "1–" : "at most "}${max} characters.`,
    );
  return value;
}
export function variables(body) {
  text(body, "Snippet text", MAX_BODY, true);
  const names = [...body.matchAll(token)].map((match) => match[1]);
  const residue = body.replace(token, "");
  if (residue.includes("{{") || residue.includes("}}"))
    throw Error(
      "Use variables like {{first_name}}: letters, numbers and underscores, beginning with a letter.",
    );
  return [...new Set(names)];
}
export function expand(body, values) {
  for (const key of variables(body))
    if (
      !Object.hasOwn(values, key) ||
      typeof values[key] !== "string" ||
      !values[key].trim()
    )
      throw Error(`Fill in ${key}.`);
  return body.replace(token, (_, key) => values[key]);
}
export function snippet(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    typeof value.id !== "string" ||
    !/^[a-zA-Z0-9_-]{1,64}$/.test(value.id)
  )
    throw Error("Invalid snippet ID.");
  const result = {
    id: value.id,
    title: text(value.title, "Title", 120, true).trim(),
    shortcut: text(value.shortcut, "Shortcut", 40).trim(),
    category: text(value.category, "Collection", 60).trim(),
    body: text(value.body, "Snippet text", MAX_BODY, true),
  };
  variables(result.body);
  return result;
}
export function validate(value) {
  if (
    !value ||
    value.version !== 1 ||
    !Array.isArray(value.snippets) ||
    value.snippets.length > MAX_ITEMS
  )
    throw Error(
      `Expected a version 1 backup with at most ${MAX_ITEMS} snippets.`,
    );
  const snippets = value.snippets.map(snippet),
    ids = new Set();
  for (const item of snippets) {
    if (ids.has(item.id)) throw Error("Duplicate snippet IDs in backup.");
    ids.add(item.id);
  }
  return { version: 1, snippets };
}
export function parseBackup(raw) {
  if (new TextEncoder().encode(raw).length > MAX_FILE)
    throw Error("Backup exceeds 2 MB.");
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw Error("This is not a valid JSON backup.");
  }
  return validate(value);
}
export function merge(current, incoming) {
  const map = new Map(
    validate(current).snippets.map((item) => [item.id, item]),
  );
  for (const item of validate(incoming).snippets) {
    if (
      map.has(item.id) &&
      JSON.stringify(map.get(item.id)) !== JSON.stringify(item)
    )
      throw Error(
        `A different version of “${item.title}” already exists. Use replace only after exporting your current library.`,
      );
    map.set(item.id, item);
  }
  return validate({ version: 1, snippets: [...map.values()] });
}
export function search(items, query, category = "") {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return items.filter(
    (item) =>
      (!category || item.category === category) &&
      words.every((word) =>
        [item.title, item.body, item.shortcut, item.category]
          .join("\n")
          .toLocaleLowerCase()
          .includes(word),
      ),
  );
}
