import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("PWA manifest is installable and accepts Android shared links via POST", () => {
  const manifest = JSON.parse(readFileSync(resolve("public/manifest.webmanifest"), "utf8"));
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.share_target.action, "/share-target");
  assert.equal(manifest.share_target.method, "POST");
  assert.equal(manifest.share_target.enctype, "multipart/form-data");
  assert.equal(manifest.share_target.params.text, "text");
  assert.equal(manifest.share_target.params.url, "url");
  for (const size of ["192x192", "512x512"]) {
    const icon = manifest.icons.find((x: { sizes: string }) => x.sizes === size);
    assert.ok(icon);
    assert.ok(readFileSync(resolve("public", icon.src.replace(/^\/+/, ""))).length > 100);
  }
});

test("share target intercepts locally without transmitting URLs to the backend", () => {
  const code = readFileSync(resolve("public/share-worker.js"), "utf8");
  assert.match(code, /event\.request\.method !== "POST"/);
  assert.match(code, /url\.pathname !== "\/share-target"/);
  assert.match(code, /indexedDB\.open/);
  assert.match(code, /MAX_TEXT = 12000/);
  assert.match(code, /Response\.redirect\(new URL\("\/\\?incoming-share=1"/);
  assert.doesNotMatch(code, /fetch\(/);
  assert.doesNotMatch(code, /cache\.put|caches\.open/);
});
