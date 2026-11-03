import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({
  stdin: {
    contents: `export * from './src/core/gemini.ts'; export * from './src/core/context.ts'; export * from './src/core/render.ts'; export * from './src/core/validation.ts'; export * from './src/core/safety.ts';`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const core = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);
const key1 = "test_key_first_12345678901234567890";
const key2 = "test_key_second_12345678901234567890";
let checks = 0;
async function test(name, fn) {
  await fn();
  checks++;
  console.log(`PASS ${name}`);
}
const config = () => ({
  ...core.defaultGeminiSettings(),
  enabled: true,
  keys: [key1, key2],
});
const success = (text) =>
  new Response(
    JSON.stringify({
      candidates: [{ finishReason: "STOP", content: { parts: [{ text }] } }],
    }),
    { status: 200 },
  );
const insights = {
  summary: "A faithful summary.",
  keyDecisions: ["Keep local storage"],
  constraints: [],
  openQuestions: [],
  tags: ["test"],
};
const options = { mode: "full" };
const draft = core.createManualDraft();
draft.title = "Test package";
draft.summary = "A summary";
draft.messages = Array.from({ length: 40 }, (_, index) => ({
  id: `m${index}`,
  role: index % 2 ? "assistant" : "user",
  content: `Message ${index}\n  code indentation`,
  position: index + 1,
}));
const item = core.materializePackage(draft);

await test(".env supports numbered keys, deduplication and model; ignores unrelated secrets", () => {
  assert.deepEqual(
    core.parseGeminiEnv(
      `GEMINI_API_KEY_1=${key1}\nexport GEMINI_API_KEYS="${key1},${key2}"\nDATABASE_PASSWORD=ignored\nGEMINI_MODEL=gemini-2.5-flash-lite`,
    ),
    { keys: [key1, key2], model: "gemini-2.5-flash-lite" },
  );
});
await test("malformed keys and excessive key counts rejected", () => {
  assert.throws(() => core.parseGeminiEnv("bad-key"));
  assert.throws(() =>
    core.parseGeminiEnv(
      Array.from({ length: 9 }, (_, i) => key1 + i).join("\n"),
    ),
  );
});
await test("disabled Gemini never makes a request", async () => {
  const result = await core.requestGemini(
    core.defaultGeminiSettings(),
    [],
    String,
    {
      fetcher: () => {
        throw new Error("must not call");
      },
    },
  );
  assert.equal(result.ok, false);
});
for (const status of [400, 401, 403, 429, 500, 503])
  await test(`HTTP ${status} fails over to next key without leaking error text`, async () => {
    const state = config();
    const calls = [];
    const result = await core.requestGemini(state, [], core.validateInsights, {
      json: true,
      fetcher: async (url, init) => {
        assert(!url.includes(key1));
        calls.push(init.headers["x-goog-api-key"]);
        return calls.length === 1
          ? new Response(key1, { status, headers: { "retry-after": "180" } })
          : success(JSON.stringify(insights));
      },
    });
    assert.equal(result.ok, true);
    assert.deepEqual(calls, [key1, key2]);
    assert.equal(state.preferred, 1);
    assert(state.health[0].retryAt > Date.now());
    assert(!JSON.stringify(state.health).includes(key1));
  });
for (const text of [
  "",
  "not JSON",
  "{}",
  JSON.stringify({ ...insights, summary: "" }),
  JSON.stringify({ ...insights, tags: "bad" }),
])
  await test(`empty or invalid output fails over (${text.slice(0, 15)})`, async () => {
    let calls = 0;
    const result = await core.requestGemini(
      config(),
      [],
      core.validateInsights,
      {
        fetcher: async () =>
          ++calls === 1 ? success(text) : success(JSON.stringify(insights)),
      },
    );
    assert.equal(result.ok, true);
    assert.equal(calls, 2);
  });
await test("cooldown skips failed keys on next request", async () => {
  const state = config();
  state.health[0] = { retryAt: Date.now() + 60000, reason: "failed" };
  const result = await core.requestGemini(state, [], String, {
    fetcher: async (_, init) => {
      assert.equal(init.headers["x-goog-api-key"], key2);
      return success("OK");
    },
  });
  assert.equal(result.ok, true);
});
await test("timeouts are bounded and try a backup key", async () => {
  let calls = 0;
  const result = await core.requestGemini(config(), [], String, {
    timeoutMs: 10,
    totalMs: 100,
    fetcher: async (_, init) =>
      ++calls === 1
        ? new Promise((_, reject) =>
            init.signal.addEventListener("abort", () =>
              reject(new Error("aborted")),
            ),
          )
        : success("OK"),
  });
  assert.equal(result.ok, true);
  assert.equal(calls, 2);
});
await test("all failures return fallback without changing the source draft", async () => {
  const before = JSON.stringify(draft);
  const result = await core.requestGemini(
    config(),
    [{ text: before }],
    String,
    {
      fetcher: async () => {
        throw new Error(key1);
      },
    },
  );
  assert.equal(result.ok, false);
  assert(!result.reason.includes(key1));
  assert.equal(JSON.stringify(draft), before);
});
await test("truncated generations do not overwrite content", async () => {
  const result = await core.requestGemini(config(), [], String, {
    fetcher: async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: "MAX_TOKENS",
              content: { parts: [{ text: "partial" }] },
            },
          ],
        }),
      ),
  });
  assert.equal(result.ok, false);
});
await test("full transfer keeps all 40 messages, line breaks and indentation", () => {
  const rendered = core.renderContextPackage(item, options);
  for (let i = 0; i < 40; i++)
    assert(rendered.includes(`Message ${i}\n  code indentation`));
});
await test("detailed transfer retains the first and most recent turns", () => {
  const rendered = core.renderContextPackage(item, { mode: "detailed" });
  assert(rendered.includes("Message 0\n"));
  assert(rendered.includes("Message 39\n"));
  assert(rendered.includes("32 messages omitted"));
});
await test("manual transcript preserves fenced code, blank lines and repeated messages", () => {
  const text =
    "USER: hello\n\nASSISTANT: ```python\n  user: value\n```\n\nUSER: hello";
  const parsed = core.parseTranscript(text);
  assert.equal(parsed.length, 3);
  assert(parsed[1].content.includes("  user: value"));
  assert.deepEqual(
    core.parseTranscript(core.serializeMessages(parsed)),
    parsed,
  );
});
await test("extracted attachment text travels with rendered context", () => {
  const rendered = core.renderContextPackage(
    {
      ...item,
      assets: [
        {
          id: "asset_test",
          name: "design.pdf",
          size: 100,
          mimeType: "application/pdf",
          source: "local",
          text: "PDF budget: 42 units",
        },
      ],
    },
    options,
  );
  assert(rendered.includes("PDF budget: 42 units"));
});
await test("invalid backup cannot enter the library", () => {
  assert.throws(() => core.validatePackages({ title: "oops" }));
  assert.throws(() => core.validatePackages({ ...item, updatedAt: "bad" }));
  assert.throws(() =>
    core.validatePackages({
      ...item,
      assets: [
        {
          id: "asset_bad",
          source: "reference",
          size: 0,
          sourceUrl: "javascript:alert(1)",
        },
      ],
    }),
  );
  assert.equal(core.validatePackages(item)[0].messages.length, 40);
});
await test("Google API keys are detected and redacted", () => {
  const secret = "AIza" + "A".repeat(35);
  assert(
    core
      .scanSensitiveContent(secret)
      .some((finding) => finding.type === "api_key"),
  );
  assert(!core.redactSensitiveContent(secret).includes(secret));
});
console.log(`${checks} core checks passed.`);
