import {
  variables,
  expand,
  snippet,
  search,
  parseBackup,
  merge,
  MAX_FILE,
} from "./core.js";
import { KEY, readStore, writeStore, recoverStore } from "./storage.js";
const $ = (id) => document.getElementById(id);
let store = null,
  selected = null,
  dirty = false,
  busy = false,
  brokenRaw = null;
function say(text) {
  $("status").textContent = text;
}
function freeze(value) {
  busy = value;
  for (const id of [
    "new",
    "save",
    "delete",
    "examples",
    "reload",
    "import",
    "mode",
    "title",
    "shortcut",
    "category",
    "body",
  ])
    $(id).disabled =
      value || (!store && ["save", "delete", "examples"].includes(id));
}
function mark(value) {
  dirty = value;
  $("dirty").textContent = dirty ? "Unsaved changes" : "No unsaved changes";
}
function draft() {
  return snippet({
    id: selected || crypto.randomUUID(),
    title: $("title").value,
    shortcut: $("shortcut").value,
    category: $("category").value,
    body: $("body").value,
  });
}
function renderList() {
  const collection = $("collection").value;
  $("collection").replaceChildren(new Option("All collections", ""));
  for (const category of [
    ...new Set((store?.snippets || []).map((s) => s.category).filter(Boolean)),
  ].sort())
    $("collection").add(new Option(category, category));
  $("collection").value = collection;
  if ($("collection").selectedIndex < 0) $("collection").value = "";
  const items = search(
    store?.snippets || [],
    $("search").value,
    $("collection").value,
  );
  $("list").replaceChildren();
  $("count").textContent = store
    ? `${items.length} of ${store.snippets.length} snippets`
    : "Library unavailable";
  $("empty").hidden = !store || store.snippets.length > 0;
  for (const item of items) {
    const li = document.createElement("li"),
      button = document.createElement("button"),
      title = document.createElement("strong"),
      meta = document.createElement("small");
    button.type = "button";
    button.setAttribute("aria-current", String(selected === item.id));
    title.textContent = item.title;
    meta.textContent =
      [item.shortcut, item.category].filter(Boolean).join(" · ") || "Unfiled";
    button.append(title, meta);
    button.onclick = () => {
      if (!busy && (!dirty || confirm("Discard the unsaved draft?")))
        open(item);
    };
    li.append(button);
    $("list").append(li);
  }
}
function open(item) {
  selected = item?.id || null;
  for (const key of ["title", "shortcut", "category", "body"])
    $(key).value = item?.[key] || "";
  $("editor-title").textContent = item ? "Edit snippet" : "New snippet";
  $("delete").hidden = !selected;
  mark(false);
  $("variables").replaceChildren();
  preview();
  renderList();
}
function preview() {
  if (!$('body').value.trim()) {
    $('variables').replaceChildren();
    $('output').value = '';
    $('copy').disabled = true;
    $('preview-status').textContent = 'Write a snippet to get started.';
    return;
  }
  const previous = Object.fromEntries(
    [...$("variables").querySelectorAll("input")].map((input) => [
      input.dataset.name,
      input.value,
    ]),
  );
  $("variables").replaceChildren();
  $("copy").disabled = true;
  $("output").value = "";
  try {
    const names = variables($("body").value);
    for (const name of names) {
      const label = document.createElement("label"),
        input = document.createElement("input");
      label.textContent = name;
      input.dataset.name = name;
      input.value = Object.hasOwn(previous, name) ? previous[name] : "";
      input.autocomplete = "off";
      input.maxLength = 5000;
      input.oninput = compose;
      label.append(input);
      $("variables").append(label);
    }
    compose();
  } catch (e) {
    $("preview-status").textContent = e.message;
  }
}
function compose() {
  try {
    const values = Object.fromEntries(
      [...$("variables").querySelectorAll("input")].map((input) => [
        input.dataset.name,
        input.value,
      ]),
    );
    $("output").value = expand($("body").value, values);
    $("copy").disabled = false;
    $("preview-status").textContent =
      "Ready to copy. Fill-in values are not saved.";
  } catch (e) {
    $("output").value = "";
    $("copy").disabled = true;
    $("preview-status").textContent = e.message;
  }
}
function load() {
  try {
    store = readStore();
    brokenRaw = null;
    renderList();
    open(null);
    say("Library loaded. Export backups regularly.");
  } catch (e) {
    store = null;
    try {
      brokenRaw = localStorage.getItem(KEY);
    } catch {}
    renderList();
    say(
      `Saved library could not be read: ${e.message} Export raw recovery data before replacing it with a valid backup.`,
    );
  }
  freeze(false);
}
for (const key of ["title", "shortcut", "category", "body"])
  $(key).oninput = () => {
    mark(true);
    if (key === "body") preview();
  };
$("search").oninput = renderList;
$("collection").onchange = renderList;
$("new").onclick = () => {
  if (!dirty || confirm("Discard the unsaved draft?")) {
    open(null);
    $("title").focus();
  }
};
$("reload").onclick = () => {
  if (!dirty || confirm("Discard the unsaved draft and reload saved data?"))
    load();
};
$("editor").onsubmit = async (e) => {
  e.preventDefault();
  if (!store || busy) return;
  let item;
  try {
    item = draft();
  } catch (err) {
    say(err.message);
    return;
  }
  freeze(true);
  try {
    store = await writeStore(store.revision, (current) => {
      const items = current.snippets.filter((s) => s.id !== item.id);
      return { ...current, snippets: [...items, item] };
    });
    open(item);
    say("Snippet saved in this browser.");
  } catch (err) {
    say(`Not saved: ${err.message}`);
  } finally {
    freeze(false);
  }
};
$("delete").onclick = async () => {
  if (
    !store ||
    !selected ||
    busy ||
    !confirm(
      "Delete this snippet? Export a backup first if you may need it again.",
    )
  )
    return;
  freeze(true);
  try {
    store = await writeStore(store.revision, (current) => ({
      ...current,
      snippets: current.snippets.filter((s) => s.id !== selected),
    }));
    open(null);
    say("Snippet deleted.");
  } catch (e) {
    say(e.message);
  } finally {
    freeze(false);
  }
};
$("copy").onclick = async () => {
  try {
    await navigator.clipboard.writeText($("output").value);
    say("Text copied. Paste it into your reply.");
  } catch {
    $("output").focus();
    $("output").select();
    say(
      "Clipboard access was denied. Your text is selected; press Ctrl/Cmd+C to copy it.",
    );
  }
};
function download(text, name) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("export").onclick = () => {
  try {
    const current = readStore();
    download(
      JSON.stringify({ version: 1, snippets: current.snippets }, null, 2),
      "snippet-cabinet-backup.json",
    );
    say(
      dirty
        ? "Saved library exported. Your unsaved draft is not included."
        : "Library exported. Keep this file somewhere safe.",
    );
  } catch (e) {
    say(`Cannot export a normal backup: ${e.message} Use raw recovery export.`);
  }
};
$("raw").onclick = () => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) {
      say("No saved data to export.");
      return;
    }
    download(raw, "snippet-cabinet-recovery.json");
    say("Raw saved data exported without modification.");
  } catch (e) {
    say(`Storage access failed: ${e.message}`);
  }
};
$("import").onchange = async () => {
  const file = $("import").files[0];
  $("import").value = "";
  if (!file || busy) return;
  freeze(true);
  try {
    if (file.size > MAX_FILE) throw Error("Backup exceeds 2 MB.");
    const incoming = parseBackup(await file.text()),
      replace = $("mode").value === "replace";
    if (dirty && !confirm("Discard your unsaved draft for this import?"))
      return;
    if (
      replace &&
      !confirm("Replace the entire saved library? Export a backup first.")
    )
      return;
    if (!store) {
      if (!replace)
        throw Error("Use replace mode only after exporting raw recovery data.");
      store = await recoverStore(brokenRaw, incoming);
    } else {
      store = await writeStore(store.revision, (current) =>
        replace ? incoming : merge(current, incoming),
      );
    }
    open(null);
    say(`Imported library: ${store.snippets.length} snippets saved.`);
  } catch (e) {
    say(`Import canceled: ${e.message}`);
  } finally {
    freeze(false);
  }
};
$("examples").onclick = async () => {
  if (!store || busy || (dirty && !confirm("Discard the unsaved draft?")))
    return;
  const examples = [
    {
      title: "Helpful support follow-up",
      shortcut: ";followup",
      category: "Support",
      body: "Hi {{first_name}},\n\nThanks for reporting {{issue}}. Could you share the steps that led to it?\n\nBest,\n{{your_name}}",
    },
    {
      title: "A clear meeting recap",
      shortcut: ";recap",
      category: "Work",
      body: "Thanks for the conversation about {{topic}}.\n\nNext step: {{next_step}}\nOwner: {{owner}}\nDue: {{date}}",
    },
  ].map((item) => ({ ...item, id: crypto.randomUUID() }));
  freeze(true);
  try {
    store = await writeStore(store.revision, (current) => ({
      ...current,
      snippets: [...current.snippets, ...examples],
    }));
    open(examples[0]);
    say("Two examples added. Make them your own.");
  } catch (e) {
    say(e.message);
  } finally {
    freeze(false);
  }
};
window.addEventListener("storage", (e) => {
  if (e.key !== KEY && e.key !== null) return;
  if (dirty || busy) {
    say(
      "The library changed in another tab. Your draft is preserved. Copy it before reloading.",
    );
  } else load();
});
window.addEventListener("beforeunload", (e) => {
  if (dirty || busy) {
    e.preventDefault();
    e.returnValue = "";
  }
});
document.addEventListener("keydown", (e) => {
  if (
    e.key === "/" &&
    !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)
  ) {
    e.preventDefault();
    $("search").focus();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !busy) {
    e.preventDefault();
    $("editor").requestSubmit();
  }
});
load();
