# PDF page for Android

Android's WebView can't show a PDF, so the app ships its own page, `assets/pdfjs/viewer.html`, built from
[pdf.js](https://github.com/mozilla/pdf.js) (Mozilla, Apache License 2.0; the license travels inside the page).

The app downloads the file, hands its bytes to the page with `postMessage`, and the page draws the pages on
canvases as they scroll into view (pinch to zoom). The page never reaches the network.

To rebuild it (e.g. for a newer pdf.js 3.x):

```sh
npm pack pdfjs-dist@3.11.174 && tar xzf pdfjs-dist-3.11.174.tgz   # unpacks to ./package
node scripts/pdfjs/build-viewer.mjs ./package
```
