// A small PowerPoint (.pptx) reader for the preview page: each slide drawn as positioned boxes (text with its
// sizes, weights and colours, pictures, solid fills, tables), the layout's and master's placeholders filling in
// what a slide leaves out. Not a full renderer: charts, SmartArt, gradients and effects are left out, so a slide
// reads right even where it doesn't look exactly as in PowerPoint. Text goes in with textContent, never as HTML.
import type JSZip from "jszip";

const P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const REL = "http://schemas.openxmlformats.org/package/2006/relationships";

/** EMU (English Metric Units) per CSS pixel: 914400 per inch, 96 pixels per inch. */
const EMU_PX = 9525;

const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  webp: "image/webp",
  svg: "image/svg+xml",
  tif: "image/tiff",
  tiff: "image/tiff",
};

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Part {
  path: string;
  doc: Document;
  rels: Map<string, string>;
}

interface Placeholder {
  box: Box | null;
  /** Text defaults from the placeholder's own list style (first level). */
  size: number | null;
  anchor: string | null;
  algn: string | null;
}

type Theme = Map<string, string>;

const kids = (el: Element | null | undefined, ns: string, name: string): Element[] =>
  el ? Array.from(el.children).filter((c) => c.namespaceURI === ns && c.localName === name) : [];
const kid = (el: Element | null | undefined, ns: string, name: string): Element | null => kids(el, ns, name)[0] ?? null;
const num = (v: string | null | undefined, d = 0) => {
  const n = v == null ? Number.NaN : Number(v);
  return Number.isFinite(n) ? n : d;
};

function resolve(base: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = base.split("/").slice(0, -1);
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

async function xml(zip: JSZip, path: string): Promise<Document | null> {
  const f = zip.file(path);
  if (!f) return null;
  const doc = new DOMParser().parseFromString(await f.async("string"), "application/xml");
  return doc.getElementsByTagName("parsererror").length ? null : doc;
}

async function part(zip: JSZip, path: string): Promise<Part | null> {
  const doc = await xml(zip, path);
  if (!doc) return null;
  const relPath = path.replace(/([^/]+)$/, "_rels/$1.rels");
  const rels = new Map<string, string>();
  const relDoc = await xml(zip, relPath);
  if (relDoc) {
    for (const r of Array.from(relDoc.getElementsByTagNameNS(REL, "Relationship"))) {
      if (r.getAttribute("TargetMode") === "External") continue;
      rels.set(r.getAttribute("Id") ?? "", resolve(path, r.getAttribute("Target") ?? ""));
    }
  }
  return { path, doc, rels };
}

function relOfType(p: Part, suffix: string): string | null {
  // Relationship types aren't kept in the map; layouts and masters are found by their target's folder.
  for (const target of p.rels.values()) if (target.includes(suffix)) return target;
  return null;
}

function themeColors(doc: Document | null): Theme {
  const map: Theme = new Map();
  const scheme = doc?.getElementsByTagNameNS(A, "clrScheme")[0];
  if (!scheme) return map;
  for (const c of Array.from(scheme.children)) {
    const v = kid(c, A, "srgbClr")?.getAttribute("val") ?? kid(c, A, "sysClr")?.getAttribute("lastClr");
    if (v) map.set(c.localName, `#${v}`);
  }
  // The names slides use for the scheme's colours.
  const alias: Record<string, string> = { tx1: "dk1", bg1: "lt1", tx2: "dk2", bg2: "lt2" };
  for (const [k, v] of Object.entries(alias)) {
    const c = map.get(v);
    if (c) map.set(k, c);
  }
  return map;
}

/** A colour element's CSS colour (sRGB, scheme, preset), with its lumMod/lumOff and alpha applied roughly. */
function color(fill: Element | null, theme: Theme): string | null {
  if (!fill) return null;
  const c = fill.firstElementChild;
  if (!c) return null;
  let hex: string | null = null;
  if (c.localName === "srgbClr") hex = `#${c.getAttribute("val")}`;
  else if (c.localName === "schemeClr") hex = theme.get(c.getAttribute("val") ?? "") ?? null;
  else if (c.localName === "sysClr") hex = `#${c.getAttribute("lastClr") ?? "000000"}`;
  else if (c.localName === "prstClr") return c.getAttribute("val");
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return null;
  let r = Number.parseInt(hex.slice(1, 3), 16);
  let g = Number.parseInt(hex.slice(3, 5), 16);
  let b = Number.parseInt(hex.slice(5, 7), 16);
  const mod = num(kid(c, A, "lumMod")?.getAttribute("val"), 100000) / 100000;
  const off = num(kid(c, A, "lumOff")?.getAttribute("val"), 0) / 100000;
  const tint = (v: number) => Math.max(0, Math.min(255, Math.round(v * mod + 255 * off)));
  r = tint(r);
  g = tint(g);
  b = tint(b);
  const alpha = num(kid(c, A, "alpha")?.getAttribute("val"), 100000) / 100000;
  return `rgba(${r},${g},${b},${alpha})`;
}

function xfrm(el: Element | null): Box | null {
  const x = el ? kid(el, A, "xfrm") : null;
  const off = kid(x, A, "off");
  const ext = kid(x, A, "ext");
  if (!off || !ext) return null;
  return {
    x: num(off.getAttribute("x")),
    y: num(off.getAttribute("y")),
    w: num(ext.getAttribute("cx")),
    h: num(ext.getAttribute("cy")),
  };
}

function phKey(sp: Element): string[] | null {
  const nv = sp.firstElementChild;
  const ph = nv?.getElementsByTagNameNS(P, "ph")[0];
  if (!ph) return null;
  const type = ph.getAttribute("type") ?? "body";
  const idx = ph.getAttribute("idx");
  return [idx ? `idx:${idx}` : "", `type:${type}`].filter(Boolean);
}

function placeholders(p: Part | null): Map<string, Placeholder> {
  const map = new Map<string, Placeholder>();
  if (!p) return map;
  for (const sp of Array.from(p.doc.getElementsByTagNameNS(P, "sp"))) {
    const keys = phKey(sp);
    if (!keys) continue;
    const body = kid(sp, P, "txBody");
    const lvl1 = kid(kid(body, A, "lstStyle"), A, "lvl1pPr");
    const sz = kid(lvl1, A, "defRPr")?.getAttribute("sz");
    const info: Placeholder = {
      box: xfrm(kid(sp, P, "spPr")),
      size: sz ? num(sz) / 100 : null,
      anchor: kid(body, A, "bodyPr")?.getAttribute("anchor") ?? null,
      algn: lvl1?.getAttribute("algn") ?? null,
    };
    for (const k of keys) if (!map.has(k)) map.set(k, info);
  }
  return map;
}

interface MasterText {
  title: number;
  body: number;
  titleAlgn: string | null;
}

/** The master's default text size for titles and for the rest (points), and its titles' alignment. */
function masterText(master: Part | null): MasterText {
  const tx = master?.doc.getElementsByTagNameNS(P, "txStyles")[0];
  const lvl1 = (name: string) => kid(kid(tx, P, name), A, "lvl1pPr");
  const size = (name: string, d: number) => {
    const sz = kid(lvl1(name), A, "defRPr")?.getAttribute("sz");
    return sz ? num(sz) / 100 : d;
  };
  return {
    title: size("titleStyle", 40),
    body: size("bodyStyle", 20),
    titleAlgn: lvl1("titleStyle")?.getAttribute("algn") ?? null,
  };
}

interface Ctx {
  zip: JSZip;
  slide: Part;
  theme: Theme;
  layoutPh: Map<string, Placeholder>;
  masterPh: Map<string, Placeholder>;
  sizes: MasterText;
  urls: string[];
}

/**
 * What a slide's placeholder takes from its layout's and then its master's: each property from the nearest that
 * sets it (a layout's title often has no position of its own, only the master's).
 */
function lookup(ctx: Ctx, keys: string[] | null): Placeholder | null {
  if (!keys) return null;
  const chain: Placeholder[] = [];
  for (const map of [ctx.layoutPh, ctx.masterPh]) {
    const hit = keys.map((k) => map.get(k)).find(Boolean);
    if (hit) chain.push(hit);
  }
  // A body placeholder with an index the layout doesn't list still takes the body's.
  if (!chain.length) {
    for (const map of [ctx.layoutPh, ctx.masterPh]) {
      const hit = map.get("type:body");
      if (hit) chain.push(hit);
    }
  }
  if (!chain.length) return null;
  const pick = <K extends keyof Placeholder>(k: K) => chain.map((p) => p[k]).find((v) => v != null) ?? null;
  return { box: pick("box"), size: pick("size"), anchor: pick("anchor"), algn: pick("algn") };
}

function place(el: HTMLElement, b: Box) {
  el.style.left = `${b.x / EMU_PX}px`;
  el.style.top = `${b.y / EMU_PX}px`;
  el.style.width = `${b.w / EMU_PX}px`;
  el.style.height = `${b.h / EMU_PX}px`;
}

function text(
  body: Element,
  ctx: Ctx,
  defSize: number,
  anchor: string | null,
  defAlgn: string | null = null,
): HTMLElement {
  const box = document.createElement("div");
  box.className = "pp-text";
  const pr = kid(body, A, "bodyPr");
  const a = pr?.getAttribute("anchor") ?? anchor ?? "t";
  box.style.justifyContent = a === "ctr" ? "center" : a === "b" ? "flex-end" : "flex-start";
  const inset = (n: string, d: number) => num(pr?.getAttribute(n), d) / EMU_PX;
  box.style.padding = `${inset("tIns", 45720)}px ${inset("rIns", 91440)}px ${inset("bIns", 45720)}px ${inset("lIns", 91440)}px`;
  const scale = num(kid(pr, A, "normAutofit")?.getAttribute("fontScale"), 100000) / 100000;
  for (const p of kids(body, A, "p")) {
    const para = document.createElement("p");
    const ppr = kid(p, A, "pPr");
    const algn =
      ppr?.getAttribute("algn") ?? kid(kid(body, A, "lstStyle"), A, "lvl1pPr")?.getAttribute("algn") ?? defAlgn;
    para.style.textAlign = algn === "ctr" ? "center" : algn === "r" ? "right" : algn === "just" ? "justify" : "left";
    const lvl = num(ppr?.getAttribute("lvl"));
    if (lvl) para.style.paddingLeft = `${lvl * 24}px`;
    const bu = kid(ppr, A, "buChar")?.getAttribute("char");
    let first = true;
    let maxSize = 0;
    for (const r of Array.from(p.children)) {
      if (r.namespaceURI !== A) continue;
      if (r.localName === "br") {
        para.appendChild(document.createElement("br"));
        continue;
      }
      if (r.localName !== "r" && r.localName !== "fld") continue;
      const rpr = kid(r, A, "rPr");
      const span = document.createElement("span");
      const t = kid(r, A, "t")?.textContent ?? "";
      span.textContent = first && bu ? `${bu} ${t}` : t;
      first = false;
      const sz = rpr?.getAttribute("sz");
      const pt = (sz ? num(sz) / 100 : defSize) * scale;
      maxSize = Math.max(maxSize, pt);
      span.style.fontSize = `${(pt * 96) / 72}px`;
      if (rpr?.getAttribute("b") === "1") span.style.fontWeight = "700";
      if (rpr?.getAttribute("i") === "1") span.style.fontStyle = "italic";
      if (rpr?.getAttribute("u") && rpr.getAttribute("u") !== "none") span.style.textDecoration = "underline";
      const c = color(kid(rpr, A, "solidFill"), ctx.theme);
      if (c) span.style.color = c;
      para.appendChild(span);
    }
    // An empty paragraph keeps its line.
    const end = kid(p, A, "endParaRPr")?.getAttribute("sz");
    const pt = maxSize || (end ? num(end) / 100 : defSize) * scale;
    para.style.fontSize = `${(pt * 96) / 72}px`;
    if (!para.childNodes.length) para.appendChild(document.createElement("br"));
    box.appendChild(para);
  }
  return box;
}

async function picture(pic: Element, ctx: Ctx, b: Box): Promise<HTMLElement | null> {
  const blip = pic.getElementsByTagNameNS(A, "blip")[0];
  const id = blip?.getAttributeNS(R, "embed");
  const path = id ? ctx.slide.rels.get(id) : undefined;
  const ext = path?.split(".").pop()?.toLowerCase() ?? "";
  const file = path ? ctx.zip.file(path) : null;
  if (!file || !IMAGE_MIME[ext]) return null;
  const blob = new Blob([await file.async("uint8array")], { type: IMAGE_MIME[ext] });
  const url = URL.createObjectURL(blob);
  ctx.urls.push(url);
  const img = document.createElement("img");
  img.className = "pp-abs";
  img.src = url;
  img.alt = "";
  place(img, b);
  return img;
}

function table(frame: Element, ctx: Ctx, b: Box): HTMLElement | null {
  const tbl = frame.getElementsByTagNameNS(A, "tbl")[0];
  if (!tbl) return null;
  const wrap = document.createElement("div");
  wrap.className = "pp-abs";
  place(wrap, b);
  wrap.style.height = "auto";
  const t = document.createElement("table");
  t.className = "pp-table";
  for (const tr of kids(tbl, A, "tr")) {
    const row = document.createElement("tr");
    for (const tc of kids(tr, A, "tc")) {
      if (tc.getAttribute("hMerge") === "1" || tc.getAttribute("vMerge") === "1") continue;
      const cell = document.createElement("td");
      const span = tc.getAttribute("gridSpan");
      if (span) cell.colSpan = num(span, 1);
      const rs = tc.getAttribute("rowSpan");
      if (rs) cell.rowSpan = num(rs, 1);
      const fill = color(kid(kid(tc, A, "tcPr"), A, "solidFill"), ctx.theme);
      if (fill) cell.style.background = fill;
      const body = kid(tc, A, "txBody");
      if (body) {
        const tx = text(body, ctx, 14, null);
        tx.style.padding = "4px 6px";
        cell.appendChild(tx);
      }
      row.appendChild(cell);
    }
    t.appendChild(row);
  }
  wrap.appendChild(t);
  return wrap;
}

async function shapes(tree: Element, ctx: Ctx, out: HTMLElement) {
  for (const el of Array.from(tree.children)) {
    if (el.namespaceURI !== P) continue;
    if (el.localName === "grpSp") {
      // A group's children are in its own child space, mapped onto its box.
      const gpr = kid(el, P, "grpSpPr");
      const x = kid(gpr, A, "xfrm");
      const box = xfrm(gpr);
      const chOff = kid(x, A, "chOff");
      const chExt = kid(x, A, "chExt");
      const g = document.createElement("div");
      g.className = "pp-abs";
      if (box && chOff && chExt) {
        place(g, box);
        const sx = box.w / Math.max(1, num(chExt.getAttribute("cx"), box.w));
        const sy = box.h / Math.max(1, num(chExt.getAttribute("cy"), box.h));
        const inner = document.createElement("div");
        inner.className = "pp-abs";
        inner.style.left = `${-num(chOff.getAttribute("x")) / EMU_PX}px`;
        inner.style.top = `${-num(chOff.getAttribute("y")) / EMU_PX}px`;
        inner.style.transformOrigin = `${num(chOff.getAttribute("x")) / EMU_PX}px ${num(chOff.getAttribute("y")) / EMU_PX}px`;
        inner.style.transform = `scale(${sx}, ${sy})`;
        g.appendChild(inner);
        await shapes(el, ctx, inner);
      } else await shapes(el, ctx, g);
      out.appendChild(g);
      continue;
    }
    const keys = el.localName === "sp" ? phKey(el) : null;
    const inherited = lookup(ctx, keys);
    const spPr = kid(el, P, "spPr");
    const b = xfrm(spPr) ?? (el.localName === "graphicFrame" ? xfrmFrame(el) : null) ?? inherited?.box ?? null;
    if (!b) continue;
    if (el.localName === "pic") {
      const img = await picture(el, ctx, b);
      if (img) out.appendChild(img);
      continue;
    }
    if (el.localName === "graphicFrame") {
      const t = table(el, ctx, b);
      if (t) out.appendChild(t);
      continue;
    }
    if (el.localName !== "sp" && el.localName !== "cxnSp") continue;
    const shape = document.createElement("div");
    shape.className = "pp-abs pp-shape";
    place(shape, b);
    const fill = color(kid(spPr, A, "solidFill"), ctx.theme);
    if (fill) shape.style.background = fill;
    const ln = kid(spPr, A, "ln");
    const lnColor = ln && !kid(ln, A, "noFill") ? color(kid(ln, A, "solidFill"), ctx.theme) : null;
    if (lnColor) shape.style.border = `${Math.max(1, num(ln?.getAttribute("w"), 9525) / EMU_PX)}px solid ${lnColor}`;
    const geom = kid(spPr, A, "prstGeom")?.getAttribute("prst");
    if (geom === "ellipse") shape.style.borderRadius = "50%";
    else if (geom === "roundRect") shape.style.borderRadius = "12px";
    const body = kid(el, P, "txBody");
    if (body) {
      const type = keys?.find((k) => k.startsWith("type:"))?.slice(5);
      const isTitle = type === "title" || type === "ctrTitle";
      const def = inherited?.size ?? (isTitle ? ctx.sizes.title : ctx.sizes.body);
      const algn = inherited?.algn ?? (isTitle ? ctx.sizes.titleAlgn : null);
      shape.appendChild(text(body, ctx, def, inherited?.anchor ?? (isTitle ? "ctr" : null), algn));
    }
    out.appendChild(shape);
  }
}

function xfrmFrame(frame: Element): Box | null {
  const x = kid(frame, P, "xfrm");
  const off = kid(x, A, "off");
  const ext = kid(x, A, "ext");
  if (!off || !ext) return null;
  return {
    x: num(off.getAttribute("x")),
    y: num(off.getAttribute("y")),
    w: num(ext.getAttribute("cx")),
    h: num(ext.getAttribute("cy")),
  };
}

function background(doc: Document, theme: Theme): string | null {
  const bg = doc.getElementsByTagNameNS(P, "bg")[0];
  if (!bg) return null;
  const pr = kid(bg, P, "bgPr");
  const fill = color(kid(pr, A, "solidFill"), theme);
  if (fill) return fill;
  const ref = kid(bg, P, "bgRef");
  return ref ? color(ref, theme) : null;
}

export interface Slides {
  width: number;
  height: number;
  /** Draws slide `i` (from 0) into a box of the slide's own size in CSS pixels. */
  draw: (i: number, into: HTMLElement) => Promise<void>;
  count: number;
}

export async function readPptx(zip: JSZip): Promise<Slides> {
  const pres = await part(zip, "ppt/presentation.xml");
  if (!pres) throw new Error("not a presentation");
  const sz = pres.doc.getElementsByTagNameNS(P, "sldSz")[0];
  const width = num(sz?.getAttribute("cx"), 12192000) / EMU_PX;
  const height = num(sz?.getAttribute("cy"), 6858000) / EMU_PX;
  const order = Array.from(pres.doc.getElementsByTagNameNS(P, "sldId"))
    .map((s) => pres.rels.get(s.getAttributeNS(R, "id") ?? ""))
    .filter((p): p is string => !!p);
  const urls: string[] = [];

  const draw = async (i: number, into: HTMLElement) => {
    const path = order[i];
    const slide = path ? await part(zip, path) : null;
    if (!slide) return;
    const layoutPath = relOfType(slide, "slideLayouts/");
    const layout = layoutPath ? await part(zip, layoutPath) : null;
    const masterPath = layout ? relOfType(layout, "slideMasters/") : null;
    const master = masterPath ? await part(zip, masterPath) : null;
    const themePath = master ? relOfType(master, "theme/") : null;
    const theme = themeColors(themePath ? await xml(zip, themePath) : null);
    const ctx: Ctx = {
      zip,
      slide,
      theme,
      layoutPh: placeholders(layout),
      masterPh: placeholders(master),
      sizes: masterText(master),
      urls,
    };
    into.style.background =
      background(slide.doc, theme) ??
      (layout ? background(layout.doc, theme) : null) ??
      (master ? background(master.doc, theme) : null) ??
      "#fff";
    // The layout's own pictures and shapes (logos, bands) that aren't placeholders, under the slide's.
    for (const base of [master, layout]) {
      if (!base) continue;
      if (base === master && layout?.doc.documentElement.getAttribute("showMasterSp") === "0") continue;
      const tree = base.doc.getElementsByTagNameNS(P, "spTree")[0];
      if (!tree) continue;
      const copy = tree.cloneNode(true) as Element;
      for (const el of Array.from(copy.children)) if (el.localName === "sp" && phKey(el)) el.remove();
      await shapes(copy, { ...ctx, slide: base }, into);
    }
    const tree = slide.doc.getElementsByTagNameNS(P, "spTree")[0];
    if (tree) await shapes(tree, ctx, into);
  };

  return { width, height, draw, count: order.length };
}
