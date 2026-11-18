// The preview page's script: Word (docx-preview), spreadsheets and CSV (SheetJS), PowerPoint (./pptx) and ZIP
// listings (JSZip), all drawn on the phone from the bytes the app sends with postMessage. Built into
// assets/preview/viewer.html by build.mjs; see README.md.
import * as XLSX from "@e965/xlsx";
import * as cptable from "@e965/xlsx/dist/cpexcel.full.mjs";
import { renderAsync } from "docx-preview";
import JSZip from "jszip";
import { readPptx } from "./pptx";

XLSX.set_cptable(cptable);

type Kind = "docx" | "sheet" | "csv" | "pptx" | "zip";
interface FileMsg {
  type: "file";
  kind: Kind;
  data: string;
}

const q = new URLSearchParams(location.search);
const root = document.documentElement.style;
for (const k of ["bg", "ink", "muted", "line", "raised"]) {
  const v = q.get(k);
  if (v) root.setProperty(`--${k}`, v);
}
const note = document.getElementById("note") as HTMLElement;
const view = document.getElementById("view") as HTMLElement;
note.textContent = q.get("loading") ?? "";

/** Rows and columns a sheet shows at most: a phone's memory, and nobody reads more on one. */
const MAX_ROWS = Number(q.get("maxRows") ?? 1000);
const MAX_COLS = 60;

function post(msg: object) {
  (window as unknown as { ReactNativeWebView?: { postMessage(s: string): void } }).ReactNativeWebView?.postMessage(
    JSON.stringify(msg),
  );
}

function fail(err: unknown) {
  note.textContent = q.get("failed") ?? "";
  note.classList.remove("hidden");
  view.replaceChildren();
  post({ type: "error", message: String((err as Error)?.message ?? err) });
}

function bytesOf(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Fits a box of `width` CSS pixels to the screen's width (pinch zoom goes further). */
function fit(box: HTMLElement, width: number, height: number) {
  const avail = Math.max(1, document.documentElement.clientWidth - 20);
  const s = Math.min(1, avail / width);
  box.style.width = `${width}px`;
  box.style.height = `${height}px`;
  box.style.transform = `scale(${s})`;
  box.style.transformOrigin = "0 0";
  const frame = el("div", "frame");
  frame.style.width = `${width * s}px`;
  frame.style.height = `${height * s}px`;
  return frame;
}

async function docx(bytes: Uint8Array) {
  const host = el("div", "docx-host");
  view.appendChild(host);
  await renderAsync(bytes, host, undefined, {
    className: "docx",
    inWrapper: true,
    breakPages: true,
    ignoreLastRenderedPageBreak: true,
    renderHeaders: true,
    renderFooters: true,
    renderFootnotes: true,
    useBase64URL: true,
    experimental: false,
  });
  // Pages keep their paper width; the whole wrapper is scaled to the screen.
  const wrapper = host.querySelector<HTMLElement>(".docx-wrapper");
  if (wrapper) {
    const width = Math.max(...Array.from(wrapper.children).map((c) => (c as HTMLElement).offsetWidth), 1);
    const avail = Math.max(1, document.documentElement.clientWidth - 20);
    if (width > avail) (wrapper.style as CSSStyleDeclaration & { zoom: string }).zoom = String(avail / width);
  }
}

/** A CSV's text: UTF-8 when it is, else GB 18030 (what Excel in Chinese saves), else Latin-1. */
function csvText(bytes: Uint8Array): string {
  for (const enc of ["utf-8", "gb18030", "windows-1252"]) {
    try {
      return new TextDecoder(enc, { fatal: true }).decode(bytes);
    } catch {
      // Not that encoding: the next one.
    }
  }
  return new TextDecoder("utf-8").decode(bytes);
}

function sheet(bytes: Uint8Array, csv: boolean) {
  const wb = csv
    ? XLSX.read(csvText(bytes), { type: "string", raw: true })
    : XLSX.read(bytes, { type: "array", cellDates: true, dense: true });
  const tabs = el("div", "tabs");
  const body = el("div", "sheet");
  if (wb.SheetNames.length > 1) view.appendChild(tabs);
  view.appendChild(body);
  const show = (i: number) => {
    Array.from(tabs.children).forEach((t, j) => {
      t.classList.toggle("on", i === j);
    });
    body.replaceChildren(table(wb.Sheets[wb.SheetNames[i] as string] as XLSX.WorkSheet));
    window.scrollTo(0, 0);
  };
  wb.SheetNames.forEach((name, i) => {
    const t = el("button", "tab", name);
    t.onclick = () => show(i);
    tabs.appendChild(t);
  });
  show(0);
}

function table(ws: XLSX.WorkSheet): HTMLElement {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, blankrows: true, defval: "" });
  const wrap = el("div", "grid-wrap");
  if (rows.length === 0) {
    wrap.appendChild(el("div", "empty", q.get("empty") ?? ""));
    return wrap;
  }
  const cols = Math.min(MAX_COLS, Math.max(...rows.slice(0, MAX_ROWS).map((r) => r.length), 1));
  const t = el("table", "grid");
  const head = el("tr");
  head.appendChild(el("th", "corner"));
  for (let c = 0; c < cols; c++) head.appendChild(el("th", undefined, XLSX.utils.encode_col(c)));
  t.appendChild(head);
  rows.slice(0, MAX_ROWS).forEach((r, i) => {
    const tr = el("tr");
    tr.appendChild(el("th", undefined, String(i + 1)));
    for (let c = 0; c < cols; c++) tr.appendChild(el("td", undefined, String(r[c] ?? "")));
    t.appendChild(tr);
  });
  wrap.appendChild(t);
  if (rows.length > MAX_ROWS) wrap.appendChild(el("div", "cut", q.get("rowsCut") ?? ""));
  return wrap;
}

async function pptx(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes);
  const deck = await readPptx(zip);
  const list = el("div", "slides");
  view.appendChild(list);
  const frames: { frame: HTMLElement; slide: HTMLElement; drawn: boolean }[] = [];
  for (let i = 0; i < deck.count; i++) {
    const slide = el("div", "slide");
    const frame = fit(slide, deck.width, deck.height);
    frame.appendChild(slide);
    frame.dataset.n = String(i);
    list.appendChild(frame);
    frames.push({ frame, slide, drawn: false });
  }
  // Slides drawn as they come near the screen: a long deck opens at once.
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        const f = frames[Number((en.target as HTMLElement).dataset.n)];
        if (!f || f.drawn) continue;
        f.drawn = true;
        io.unobserve(f.frame);
        deck.draw(Number(f.frame.dataset.n), f.slide).catch(() => {});
      }
    },
    { rootMargin: "100% 0px" },
  );
  for (const f of frames) io.observe(f.frame);
}

function size(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

async function zip(bytes: Uint8Array) {
  const z = await JSZip.loadAsync(bytes);
  // Folders are listed even when the archive only has the files inside them.
  const entries = new Map<string, number | null>();
  for (const [name, f] of Object.entries(z.files)) {
    const parts = name.replace(/\/$/, "").split("/");
    for (let i = 1; i < parts.length; i++) entries.set(`${parts.slice(0, i).join("/")}/`, null);
    if (!f.dir)
      entries.set(name, (f as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? -1);
    else entries.set(name.endsWith("/") ? name : `${name}/`, null);
  }
  const list = el("div", "zip");
  for (const name of Array.from(entries.keys()).sort((a, b) => a.localeCompare(b))) {
    const s = entries.get(name);
    const dir = name.endsWith("/");
    const parts = name.replace(/\/$/, "").split("/");
    const row = el("div", dir ? "entry dir" : "entry");
    row.style.paddingLeft = `${12 + (parts.length - 1) * 16}px`;
    row.appendChild(el("span", "icon", dir ? "▸" : "·"));
    row.appendChild(el("span", "name", parts[parts.length - 1] ?? name));
    if (!dir && typeof s === "number" && s >= 0) row.appendChild(el("span", "size", size(s)));
    list.appendChild(row);
  }
  view.appendChild(list);
}

const KINDS: Record<Kind, (b: Uint8Array) => Promise<void> | void> = {
  docx,
  sheet: (b) => sheet(b, false),
  csv: (b) => sheet(b, true),
  pptx,
  zip,
};

let started = false;
function onMessage(e: MessageEvent) {
  let msg: FileMsg | null = null;
  try {
    msg = JSON.parse(String(e.data)) as FileMsg;
  } catch {
    return;
  }
  if (msg?.type !== "file" || started || !(msg.kind in KINDS)) return;
  started = true;
  const kind = msg.kind;
  const bytes = bytesOf(msg.data);
  Promise.resolve()
    .then(() => KINDS[kind](bytes))
    .then(() => {
      note.classList.add("hidden");
      post({ type: "loaded" });
    })
    .catch(fail);
}
window.addEventListener("message", onMessage);
document.addEventListener("message", onMessage as EventListener);
post({ type: "ready" });
