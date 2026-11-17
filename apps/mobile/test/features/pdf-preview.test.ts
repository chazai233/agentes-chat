import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const app = (path: string) => readFileSync(join(import.meta.dir, "..", "..", path), "utf8");

test("a PDF opens in the app on Android too: our pdf.js page, its card only for files too big or unreadable", () => {
  const viewer = app("src/features/files/DocumentViewer.tsx");
  expect(viewer).toContain('pdf && Platform.OS === "ios" ? (');
  expect(viewer).toContain("<AndroidPdfPage detail={detail} info={info} />");
  expect(viewer).toContain("info.size <= PDF_MAX_BYTES");
  // The page stays on the phone's own files; a link in the PDF never navigates it away.
  expect(viewer).toContain('onShouldStartLoadWithRequest={(r) => r.url.startsWith("file://")}');
  expect(viewer).toContain('else if (msg?.type === "error") setFailed(true);');
});

test("the PDF page is self-contained: pdf.js, its worker, CMaps and license inline, nothing fetched", () => {
  const page = app("assets/pdfjs/viewer.html");
  expect(page).toContain("Apache License");
  expect(page).toContain('id="pdfjs-worker"');
  expect(page).toContain('"UniGB-UCS2-H":');
  expect(page).not.toMatch(/<script[^>]+src=/);
  expect(page).not.toMatch(/<link[^>]+href=/);
  // Bytes come by message, after the page says it's ready.
  expect(page).toContain('post({ type: "ready" })');
});
