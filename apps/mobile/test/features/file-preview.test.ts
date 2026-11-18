import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const app = (path: string) => readFileSync(join(import.meta.dir, "..", "..", path), "utf8");

test("PDFs, Office files, tables and ZIPs open on the app's preview pages; too big or unreadable, their card", () => {
  const viewer = app("src/features/files/DocumentViewer.tsx");
  // iPhones draw PDFs and Office files natively; CSV goes to our page there too.
  expect(viewer).toContain('(pdf || (office !== null && office !== "csv")) && Platform.OS === "ios" ? (');
  expect(viewer).toContain('<PreviewPage detail={detail} info={info} page="pdf" />');
  expect(viewer).toContain('<PreviewPage detail={detail} info={info} page="file" kind={office} />');
  expect(viewer).toContain('<PreviewPage detail={detail} info={info} page="file" kind="zip" />');
  expect(viewer).toContain("info.size <= PREVIEW_MAX_BYTES");
  // The page stays on itself; a link in the file never navigates it away.
  expect(viewer).toContain("onShouldStartLoadWithRequest={(r) => r.url.startsWith(page.data as string)}");
  expect(viewer).toContain('else if (msg?.type === "error") setFailed(`page: ${msg.message ?? ""}`);');
  expect(viewer).toContain("<AudioPage detail={detail} info={info} />");
});

test("the Office page is self-contained and kept off the network", () => {
  const page = app("assets/preview/viewer.html");
  expect(page).toContain("default-src 'none'");
  expect(page).toContain("docx-preview 0.4.1 (Apache-2.0)");
  expect(page).not.toMatch(/<script[^>]+src=/);
  expect(page).toContain('"ready"');
});

test("the PDF page is self-contained: pdf.js, its worker, CMaps and license inline, nothing fetched", () => {
  const page = app("assets/pdfjs/viewer.html");
  expect(page).toContain("Apache License");
  expect(page).toContain("default-src 'none'");
  expect(page).toContain('id="pdfjs-worker"');
  expect(page).toContain('"UniGB-UCS2-H":');
  expect(page).not.toMatch(/<script[^>]+src=/);
  expect(page).not.toMatch(/<link[^>]+href=/);
  // Bytes come by message, after the page says it's ready.
  expect(page).toContain('post({ type: "ready" })');
});
