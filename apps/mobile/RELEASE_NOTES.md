Baiyu Bot v1.2.7 for Android (arm64, Android 7+). Installs over v1.2.6.

- Previews read the file only after it is written: v1.2.6 read the downloaded copy while it was still being saved,
  so a PDF showed "empty file". An empty copy is never kept now.
- The same kind of unfinished write fixed for sent files, long drafts sent as a file, joined voice takes, the app's
  sounds and its saved state (file writes became asynchronous in the file system library; these now finish first).

Same previews as v1.2.4:

- Common files open inside the app instead of only showing their card:
  - Word (.docx): pages as in Word, pinch to zoom.
  - Excel and tables (.xlsx, .xlsm, .xls, .ods, .csv, .tsv): a grid with a tab per sheet; the first 1,000 rows of a
    sheet. CSV files saved by Chinese Excel (GB 18030) read right.
  - PowerPoint (.pptx): every slide, one under another, with its text, pictures, colours and tables (charts and
    effects are left out).
  - ZIP: the folders and files inside, with their sizes.
  - Audio (.mp3, .m4a, .aac, .wav, .ogg, .opus, .flac, .amr): the player, with a timeline.
  - SVG and BMP pictures, and source code files (.py, .js, .ts, .java, .kt, .swift, .go, .sql, .sh and more), as text.
- Everything is drawn on the phone: the files are downloaded once into the app's cache, and the preview pages reach
  no network.
- Still a card, with Share to open elsewhere: old .doc and .ppt, Apple Pages/Numbers/Keynote, other archives
  (.rar, .7z, .tar.gz), and files over 40 MB.

中文：修复预览读到“空文件”：v1.2.6 在文件还没写完时就去读了。同类问题也一并修了（发送文件、长草稿转文件、语音拼接、提示音和本地状态保存）。v1.2.4 的内容：常见文件都能在应用里直接预览了：Word、Excel/CSV（含中文 Excel 导出的 GBK 编码）、PPT、ZIP 目录、音频、SVG 图片和代码文件。旧版 .doc/.ppt、rar/7z 压缩包和超过 40 MB 的文件仍显示文件卡片，可用“分享”在其他应用打开。
