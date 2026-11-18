// Builds assets/preview/viewer.html: one self-contained page that previews Word, spreadsheets, CSV, PowerPoint and
// ZIP files on the phone (see README.md here).
//
//   cd apps/mobile/scripts/preview && bun install && bun build.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const result = await Bun.build({
  entrypoints: [join(here, "entry.ts")],
  target: "browser",
  format: "iife",
  minify: true,
  // JSZip's browser build looks for a `require` and, finding none, uses its own; the bundle's name for it must exist.
  banner: "var __require;",
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
const script = await result.outputs[0].text();

// What the page bundles, with its license (each package's own file).
const bundled = [
  ["docx-preview", "LICENSE"],
  ["jszip", "LICENSE.markdown"],
  ["@e965/xlsx", "LICENSE"],
];
const licenses = bundled
  .map(([pkg, file]) => {
    const meta = JSON.parse(readFileSync(join(here, "node_modules", pkg, "package.json"), "utf8"));
    const text = readFileSync(join(here, "node_modules", pkg, file), "utf8");
    return `${pkg} ${meta.version} (${meta.license})\n\n${text}`;
  })
  .join("\n\n----\n\n");

// Text inside a <script> may not contain "</script" (or "<!--", which changes how the tag ends).
const inline = (text, what) => {
  const safe = text.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");
  if (/<\/script|<!--/i.test(safe)) throw new Error(`${what} can't be put inside a <script>`);
  return safe;
};

let html = readFileSync(join(here, "template.html"), "utf8");
html = html
  .replace("__LICENSES__", () => inline(licenses, "licenses"))
  .replace("__SCRIPT__", () => inline(script, "script"));
const out = join(here, "../../assets/preview/viewer.html");
writeFileSync(out, html);
console.log(`${out} (${(html.length / 1e6).toFixed(2)} MB)`);
