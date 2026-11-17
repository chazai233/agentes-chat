// Builds assets/pdfjs/viewer.html: one self-contained page (pdf.js, its worker and its CMaps inline) that the
// Android app loads from its own files to show a PDF, since Android's WebView has no PDF viewer.
//
//   node scripts/pdfjs/build-viewer.mjs <path to an unpacked pdfjs-dist 3.11.x package>
//
// The legacy build is used because it runs on older Android WebViews. See README.md here.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkg = process.argv[2];
if (!pkg) {
  console.error("usage: node scripts/pdfjs/build-viewer.mjs <pdfjs-dist package folder>");
  process.exit(1);
}
const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(pkg, p), "utf8");
const version = JSON.parse(read("package.json")).version;

// Text inside a <script> may not contain "</script" (or "<!--", which changes how the tag ends).
const inline = (text, what) => {
  if (/<\/script|<!--/i.test(text)) throw new Error(`${what} can't be put inside a <script>`);
  return text;
};

const cmaps = {};
for (const f of readdirSync(join(pkg, "cmaps"))) {
  if (f.endsWith(".bcmap"))
    cmaps[f.slice(0, -".bcmap".length)] = readFileSync(join(pkg, "cmaps", f)).toString("base64");
}

const parts = {
  __PDFJS_VERSION__: version,
  __LICENSE__: inline(read("LICENSE"), "LICENSE"),
  __PDFJS__: inline(read("legacy/build/pdf.min.js"), "pdf.min.js"),
  __WORKER__: inline(read("legacy/build/pdf.worker.min.js"), "pdf.worker.min.js"),
  __CMAPS__: JSON.stringify(cmaps),
};
let html = readFileSync(join(here, "viewer.template.html"), "utf8");
for (const [key, value] of Object.entries(parts)) html = html.split(key).join(value);

const out = join(here, "../../assets/pdfjs/viewer.html");
writeFileSync(out, html);
console.log(`pdf.js ${version}: ${out} (${(html.length / 1e6).toFixed(2)} MB)`);
