Baiyu Bot v1.2.10 for Android (arm64, Android 7+). Installs over v1.2.9.

- A screen that breaks ("Something went wrong on this page") now shows where, in small selectable text under the
  error, and each release carries the build's source map beside the APK, so the place can be read back and fixed.

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

中文：页面出错时在错误下方显示出错位置（可复制），每个版本附带源码映射文件，便于定位修复。此前：修复发送图片和文件失败（Unsupported FormDataPart implementation），文件名（含中文）保持原样。此前：文件“⋯”菜单改为应用自己的底部菜单（点空白处、下滑或返回键都能关闭），新增“下载”和“用其他应用打开”；底部按钮改为“下载”和“发送到…”，“共享设置”移入菜单。此前：修复预览读到“空文件”：v1.2.6 在文件还没写完时就去读了。同类问题也一并修了（发送文件、长草稿转文件、语音拼接、提示音和本地状态保存）。v1.2.4 的内容：常见文件都能在应用里直接预览了：Word、Excel/CSV（含中文 Excel 导出的 GBK 编码）、PPT、ZIP 目录、音频、SVG 图片和代码文件。旧版 .doc/.ppt、rar/7z 压缩包和超过 40 MB 的文件仍显示文件卡片，可用“分享”在其他应用打开。
