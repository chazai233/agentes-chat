Baiyu Bot v1.2.8 for Android (arm64, Android 7+). Installs over v1.2.7.

- A file's "…" opens the app's own sheet instead of the system dialog, which on Android held three buttons, lost
  Cancel and couldn't be closed by a tap outside. It shows the file's name, type and size, and: Download, Open in
  another app, Send to…, Save to Photos (pictures and videos), Sharing settings and View in Drive. A tap outside, a
  flick down or Back closes it.
- Download (new): Android asks once for the folder (Downloads suggested) and saves there from then on.
- Open in another app (new): the phone's own "Open with" (WPS, a browser…).
- The file screen's bottom buttons are now Download and Send to…; Sharing settings moved to the "…".
- Change photo (Me › Account) on Android: the same sheet, so Cancel is back.

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

中文：文件“⋯”菜单改为应用自己的底部菜单（点空白处、下滑或返回键都能关闭），新增“下载”和“用其他应用打开”；底部按钮改为“下载”和“发送到…”，“共享设置”移入菜单。此前：修复预览读到“空文件”：v1.2.6 在文件还没写完时就去读了。同类问题也一并修了（发送文件、长草稿转文件、语音拼接、提示音和本地状态保存）。v1.2.4 的内容：常见文件都能在应用里直接预览了：Word、Excel/CSV（含中文 Excel 导出的 GBK 编码）、PPT、ZIP 目录、音频、SVG 图片和代码文件。旧版 .doc/.ppt、rar/7z 压缩包和超过 40 MB 的文件仍显示文件卡片，可用“分享”在其他应用打开。
