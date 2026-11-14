const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
  });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "snippet-acceptance-"));
  try {
    const base = process.env.TEST_URL || "http://127.0.0.1:5130";
    const context = await browser.newContext({
      viewport: { width: 1400, height: 1100 },
      permissions: ["clipboard-read", "clipboard-write"],
      acceptDownloads: true,
    });
    const page = await context.newPage();
    const errors = [],
      remote = [];
    context.on("page", (p) => {
      p.on("pageerror", (e) => errors.push(e.message));
      p.on("dialog", (d) => d.accept());
    });
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    context.on("request", (r) => {
      if (new URL(r.url()).origin !== new URL(base).origin)
        remote.push(r.url());
    });
    await page.goto(base);
    await page.getByRole("button", { name: "Add example snippets" }).click();
    await page.getByLabel("first_name", { exact: true }).fill("Ada");
    await page.getByLabel("issue", { exact: true }).fill("the export button");
    await page.getByLabel("your_name", { exact: true }).fill("Sam");
    await page.getByRole("button", { name: "Copy text", exact: true }).click();
    assert.match(
      await page.evaluate(() => navigator.clipboard.readText()),
      /Hi Ada/,
    );
    await page
      .getByRole("button", { name: "New snippet", exact: true })
      .click();
    await page.getByLabel("Title", { exact: true }).fill("Bug report");
    await page.getByLabel("Shortcut label").fill(";bug");
    await page.getByLabel("Collection name").fill("Engineering");
    await page.getByLabel("Snippet text").fill("Please describe {{steps}}.");
    await page
      .getByRole("button", { name: "Save snippet", exact: true })
      .click();
    await page.waitForFunction(() =>
      document.querySelector("#status").textContent.includes("Snippet saved"),
    );
    await page
      .getByLabel("steps", { exact: true })
      .fill("clicking <script>test</script>");
    assert.equal(
      await page.getByLabel("Ready-to-use text").inputValue(),
      "Please describe clicking <script>test</script>.",
    );
    await page.reload();
    await page.getByLabel("Search", { exact: true }).fill(";bug");
    assert.equal(await page.locator("#list li").count(), 1);
    await page.getByRole("button", { name: /Bug report/ }).click();
    assert.equal(
      await page.getByLabel("steps", { exact: true }).inputValue(),
      "",
    );
    await page.getByLabel("steps", { exact: true }).fill("the exact steps");
    await page.getByLabel("Search", { exact: true }).fill("");
    const event = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export backup", exact: true })
      .click();
    const backup = path.join(tmp, "backup.json");
    await (await event).saveAs(backup);
    const saved = JSON.parse(fs.readFileSync(backup, "utf8"));
    assert.equal(saved.snippets.length, 3);
    assert.ok(!fs.readFileSync(backup, "utf8").includes("the exact steps"));
    await page.screenshot({
      path: path.join(__dirname, "artifacts/studio.png"),
      fullPage: true,
    });
    const tab = await context.newPage();
    await tab.goto(base);
    await page.getByLabel("Title", { exact: true }).fill("Unsaved local draft");
    await tab.getByRole("button", { name: /Bug report/ }).click();
    await tab
      .getByLabel("Title", { exact: true })
      .fill("Changed in another tab");
    await tab
      .getByRole("button", { name: "Save snippet", exact: true })
      .click();
    await tab.waitForFunction(() =>
      document.querySelector("#status").textContent.includes("Snippet saved"),
    );
    await page
      .getByRole("button", { name: "Save snippet", exact: true })
      .click();
    await page.waitForFunction(() =>
      document.querySelector("#status").textContent.startsWith("Not saved:"),
    );
    assert.equal(
      await page.getByLabel("Title", { exact: true }).inputValue(),
      "Unsaved local draft",
    );
    await page.getByText("Import & recovery", { exact: true }).click();
    await page
      .getByRole("button", { name: "Reload library", exact: true })
      .click();
    await page
      .getByLabel("JSON backup")
      .setInputFiles({
        name: "bad.json",
        mimeType: "application/json",
        buffer: Buffer.from("{bad"),
      });
    await page.waitForFunction(() =>
      document
        .querySelector("#status")
        .textContent.startsWith("Import canceled:"),
    );
    assert.equal(await page.locator("#list li").count(), 3);
    await page.getByLabel("JSON backup").setInputFiles(backup);
    await page.waitForFunction(() =>
      document
        .querySelector("#status")
        .textContent.includes("different version"),
    );
    await page.getByLabel("Import mode").selectOption("replace");
    await page.getByLabel("JSON backup").setInputFiles(backup);
    await page.waitForFunction(() =>
      document
        .querySelector("#status")
        .textContent.startsWith("Imported library"),
    );
    await page.getByRole("button", { name: /Bug report/ }).click();
    await page.getByRole("button", { name: "Delete snippet" }).click();
    await page.waitForFunction(
      () =>
        document.querySelector("#status").textContent === "Snippet deleted.",
    );
    assert.equal(await page.locator("#list li").count(), 2);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: path.join(__dirname, "artifacts/mobile.png"),
      fullPage: true,
    });
    await tab.close();
    await page.evaluate(() =>
      localStorage.setItem("snippet-cabinet-v1", "broken-data"),
    );
    await page.reload();
    await page.waitForFunction(() =>
      document
        .querySelector("#status")
        .textContent.includes("could not be read"),
    );
    assert.equal(
      await page.evaluate(() => localStorage.getItem("snippet-cabinet-v1")),
      "broken-data",
    );
    await page.getByText("Import & recovery", { exact: true }).click();
    const recoveryDownload = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export raw recovery data" })
      .click();
    const raw = path.join(tmp, "raw.json");
    await (await recoveryDownload).saveAs(raw);
    assert.equal(fs.readFileSync(raw, "utf8"), "broken-data");
    await page.getByLabel("Import mode").selectOption("replace");
    await page.getByLabel("JSON backup").setInputFiles(backup);
    await page.waitForFunction(() =>
      document
        .querySelector("#status")
        .textContent.startsWith("Imported library"),
    );
    assert.equal(await page.locator("#list li").count(), 3);
    assert.deepEqual(errors, []);
    assert.deepEqual(remote, []);
    console.log(
      "PASS: examples, create/edit, variables, clipboard, search, reload persistence, JSON round-trip, conflicting import, corrupt import, delete, cross-tab stale-write protection, raw recovery and restore; no external requests or script errors.",
    );
  } finally {
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})();
