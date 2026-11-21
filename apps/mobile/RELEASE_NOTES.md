Baiyu Bot v1.3.0 for Android (arm64, Android 7+). Installs over v1.2.10.

Brought up to date with agentes.chat's latest code (main of 2026-11-21, which matches server 0.1.10), keeping this
fork's name, 3D agents, icons and phone fixes:

- Works with server 0.1.10: conversations with its new live files (spreadsheets, slides, canvases) no longer break
  ("Cannot read property 'slice' of undefined"), and a kind of file the app doesn't know yet shows as a plain card.
- The official file screen replaces this fork's own: PDFs page by page, Word, Excel and PowerPoint as the server reads
  them, live files you edit together, comments on files, and the file's actions in the app's own menu.
- Everything else upstream added since mid-November: Threads and Agents beside their lists, the app-icon maker, the
  faster lists and screens, the new pins (swipe or hold a conversation), and more.
- Kept from this fork: uploads keep their file names (Chinese names included); still skies and lighter agents on
  Android; hidden tabs frozen while away; the launch splash leaves at once when the app is ready.
- A screen that breaks shows where it broke; each release carries its source map.

中文：同步官方最新代码（与服务器 0.1.10 匹配），修复"验收申请"等对话打开即崩溃（服务器新增的实时表格/幻灯片/画布类型）；文件预览换成官方新版（PDF 逐页、Word/Excel/PPT、实时文件、文件评论）；保留摆鱼的名字、3D 形象、图标，以及中文文件名上传、安卓流畅度等改动。
