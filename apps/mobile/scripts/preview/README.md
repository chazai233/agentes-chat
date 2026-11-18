# File preview page

`assets/preview/viewer.html` is the page the app uses to show Word (.docx), spreadsheets (.xlsx, .xlsm, .xls, .ods),
CSV/TSV, PowerPoint (.pptx) and ZIP files. It is self-contained (one HTML file, no network: its content policy is
`default-src 'none'`); the app sends it the file's bytes with `postMessage`.

What it bundles, each under its own license (the texts travel inside the page):

- [docx-preview](https://github.com/VolodymyrBaydalka/docxjs) 0.4.1, Apache-2.0: Word documents as pages.
- [SheetJS](https://sheetjs.com) 0.20.3 (npm `@e965/xlsx`, a copy of the official build), Apache-2.0: spreadsheets
  and CSV, with its code pages (Chinese Excel files and GB 18030 CSVs read right).
- [JSZip](https://stuk.github.io/jszip/) 3.10.1, MIT (dual MIT/GPLv3): ZIP listings and PowerPoint's parts.
- `pptx.ts` here: our own small PowerPoint reader (text, pictures, fills, tables; no charts or effects).

To rebuild it:

```sh
cd apps/mobile/scripts/preview && bun install && bun build.mjs
```
