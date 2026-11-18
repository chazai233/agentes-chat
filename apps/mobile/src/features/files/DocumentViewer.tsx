import { type ArtifactDetail, useApi, useArtifact } from "@agenteschat/client";
import { formatJson, highlightCode } from "@agenteschat/client/lib/code";
import { isJsonFile } from "@agenteschat/client/lib/files";
import { useQuery } from "@tanstack/react-query";
import { Asset } from "expo-asset";
import { Image } from "expo-image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Platform, Text as RNText, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Button, CARD_PAD, IconButton, SCREEN_X, Text, ToastHost, useToast } from "@/ui";
import { CodeText, RawToggle } from "../chat/CodeCard";
import { MessageText } from "../chat/MessageText";
import { useColors, useDirectory, useOrgId } from "../shared/hooks";
import { copyText, goBack, MONO } from "../shared/parts";
import { useFileActions } from "./actions";
import { type FileInfo, fileInfo, officeKindOf } from "./logic";
import { FileTile, useFileLine } from "./MessageFiles";
import { fileText, useFileBytes, useRemoteFile } from "./source";
import { VideoPlayer } from "./VideoPlayer";

/**
 * A file opened from a message: Markdown, text and code drawn by the app; PDF, Word, spreadsheets, CSV, PowerPoint and
 * ZIP on the app's own preview pages (iOS's web view draws PDFs and Office files natively, so it shows those itself);
 * pictures, video and audio in our players; anything else as its card. Top: close,
 * Copiar texto and the "…", then the name and "Documento · 4 KB · Theo" on a row of their own. Bottom: Download and
 * Send to…; the rest (open in another app, sharing settings, View in Drive) in the "…".
 */
export function DocumentViewer({ id, version }: { id: string; version?: number }) {
  return (
    <ToastHost>
      <Viewer id={id} {...(version !== undefined ? { version } : {})} />
    </ToastHost>
  );
}

function Viewer({ id, version }: { id: string; version?: number }) {
  const { t } = useTranslation();
  const orgId = useOrgId();
  const dir = useDirectory();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const line = useFileLine();
  const query = useArtifact(orgId, id, version);
  const detail = query.data;
  const actions = useFileActions(detail);
  const toast = useToast();
  const info = detail ? fileInfo(detail) : null;
  const textual = info?.view === "markdown" || info?.view === "text";
  // The page's own text, read once for the page and for Copiar texto.
  const text = useFileText(detail, textual);
  const close = () => goBack();
  const copy = () => {
    if (text.data === undefined) return;
    void copyText(text.data).then((ok) =>
      toast(ok ? { title: t("contextMenu.textCopied"), icon: "copy" } : { title: t("mobile.app.failed"), icon: "x" }),
    );
  };
  const pdf = info?.view === "pdf";
  const office = info?.view === "office" ? officeKindOf(info.name, info.mime) : null;
  // The preview pages take the bytes by message; past this size the file shows its card.
  const fits = info ? info.size === null || info.size <= PREVIEW_MAX_BYTES : false;

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <IconButton icon="x" plate label={t("mobile.common.close")} onPress={close} />
        <View style={styles.spacer} />
        {textual ? (
          <IconButton
            icon="copy"
            plate
            label={t("contextMenu.copyText")}
            onPress={copy}
            disabled={text.data === undefined}
          />
        ) : null}
        <IconButton
          icon="more"
          plate
          label={t("mobile.files.more")}
          onPress={() => actions.more(info?.view === "video")}
          disabled={!detail}
        />
      </View>
      {/* The name and its line under the buttons, the screen's whole width: never cut to one line beside them. */}
      <View style={styles.heading}>
        <Text variant="body" style={styles.bold} numberOfLines={3}>
          {info?.name ?? ""}
        </Text>
        <Text variant="footnote" tone="faint">
          {info && detail ? line(info, [dir.nameOf(detail.createdBy)]) : ""}
        </Text>
      </View>

      <View style={styles.body}>
        {query.isError ? (
          <Center>
            <Text variant="body" tone="muted">
              {t("mobile.files.loadFailed")}
            </Text>
          </Center>
        ) : !detail || !info ? (
          <Center>
            <ActivityIndicator color={c.faint} />
          </Center>
        ) : info.view === "markdown" || info.view === "text" ? (
          <TextPage detail={detail} markdown={info.view === "markdown"} json={isJsonFile(info.name, info.mime)} />
        ) : (pdf || (office !== null && office !== "csv")) && Platform.OS === "ios" ? (
          <NativePage detail={detail} />
        ) : pdf && fits ? (
          <PreviewPage detail={detail} info={info} page="pdf" />
        ) : office && fits ? (
          <PreviewPage detail={detail} info={info} page="file" kind={office} />
        ) : info.view === "archive" && fits ? (
          <PreviewPage detail={detail} info={info} page="file" kind="zip" />
        ) : info.view === "audio" ? (
          <AudioPage detail={detail} info={info} />
        ) : info.view === "video" ? (
          <VideoPage detail={detail} info={info} />
        ) : info.view === "image" ? (
          <ImagePage detail={detail} info={info} />
        ) : (
          <BigCard info={info} />
        )}
      </View>

      <View style={[styles.bar, { paddingBottom: insets.bottom + 12, borderTopColor: c.line2, backgroundColor: c.bg }]}>
        {/* Download and Send to…: what a file opened on a phone is most often for; the rest in the "…". */}
        <View style={styles.half}>
          <Button
            variant="secondary"
            wide
            icon="download"
            label={t("mobile.files.download")}
            disabled={!detail || (actions.busy !== null && actions.busy !== "download")}
            loading={actions.busy === "download"}
            onPress={() => void actions.download()}
          />
        </View>
        <View style={styles.half}>
          <Button
            variant="primary"
            wide
            icon="share"
            label={t("mobile.files.sendTo")}
            disabled={!detail || (actions.busy !== null && actions.busy !== "share")}
            loading={actions.busy === "share"}
            onPress={() => void actions.share()}
          />
        </View>
      </View>
    </View>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <View style={styles.center}>{children}</View>;
}

/** A Markdown or text file's text, loaded once per version. */
function useFileText(detail: ArtifactDetail | undefined, enabled: boolean) {
  const api = useApi();
  const orgId = useOrgId();
  return useQuery({
    queryKey: ["org", orgId, "artifacts", "text", detail?.id, detail?.shownVersion] as const,
    queryFn: () => fileText(api, orgId, detail as ArtifactDetail),
    enabled: enabled && detail !== undefined,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/**
 * Markdown with the messages' renderer, plain text in mono, on a raised page. JSON formatted and colored as a code
 * block reads it, the text as written one press away ("Original").
 */
function TextPage({ detail, markdown, json }: { detail: ArtifactDetail; markdown: boolean; json: boolean }) {
  const { t } = useTranslation();
  const c = useColors();
  const text = useFileText(detail, true);
  const formatted = useMemo(() => (json && text.data !== undefined ? formatJson(text.data) : null), [json, text.data]);
  const [raw, setRaw] = useState(false);
  return (
    <View style={[styles.page, { backgroundColor: c.raised }]}>
      {text.data !== undefined ? (
        <ScrollView contentContainerStyle={styles.pageInner}>
          {markdown ? (
            <MessageText body={text.data} />
          ) : formatted !== null ? (
            <View style={styles.json}>
              {formatted !== text.data.trim() ? <RawToggle on={raw} onPress={() => setRaw((r) => !r)} /> : null}
              <CodeText lines={highlightCode(raw ? text.data : formatted, "json")} wrap />
            </View>
          ) : (
            <RNText selectable style={[styles.mono, { color: c.ink2 }]}>
              {text.data}
            </RNText>
          )}
        </ScrollView>
      ) : text.isError ? (
        <Center>
          <Text variant="body" tone="muted">
            {t("mobile.files.loadFailed")}
          </Text>
        </Center>
      ) : (
        <Center>
          <ActivityIndicator color={c.faint} />
        </Center>
      )}
    </View>
  );
}

/**
 * A PDF or Office file on an iPhone, from its short-lived link (with the session when the link is ours): iOS's web
 * view draws them natively.
 */
function NativePage({ detail }: { detail: ArtifactDetail }) {
  const orgId = useOrgId();
  const c = useColors();
  const link = useRemoteFile(orgId, detail.id, detail.shownVersion);
  return (
    <View style={[styles.page, styles.clip, { backgroundColor: c.raised }]}>
      {link.data ? (
        <WebView
          source={{ uri: link.data.uri, headers: link.data.headers }}
          originWhitelist={["https://*", "http://*"]}
          javaScriptEnabled={false}
          startInLoadingState
          renderLoading={() => (
            <Center>
              <ActivityIndicator color={c.faint} />
            </Center>
          )}
          style={styles.web}
        />
      ) : (
        <Center>
          <ActivityIndicator color={c.faint} />
        </Center>
      )}
    </View>
  );
}

/**
 * The biggest file a preview page draws: the bytes cross to the web view as text (a third larger), held twice for a
 * moment. Past it, the file's card and Compartilhar.
 */
const PREVIEW_MAX_BYTES = 40 * 1024 * 1024;

/** Rows a sheet shows at most on the preview page. */
const SHEET_ROWS = 1000;

/**
 * The app's preview pages, each one self-contained HTML in the app (see their READMEs): pdf.js for PDFs
 * (scripts/pdfjs), and Word, spreadsheets, CSV, PowerPoint and ZIP (scripts/preview).
 */
const PAGES = {
  pdf: require("../../../assets/pdfjs/viewer.html"),
  file: require("../../../assets/preview/viewer.html"),
} as const;
type PageName = keyof typeof PAGES;

/** A preview page as a file on the phone, copied out of the app once. */
function usePage(name: PageName) {
  return useQuery({
    queryKey: ["preview-page", name] as const,
    queryFn: async () => {
      const asset = Asset.fromModule(PAGES[name]);
      await asset.downloadAsync();
      if (!asset.localUri) throw new Error("preview page missing");
      return asset.localUri;
    },
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });
}

/**
 * A file drawn by one of the app's preview pages: the page loads from the app's own files, reaches no network (its
 * content policy says so), and gets the bytes by message once it says it's ready. PDFs page by page with pinch zoom;
 * Word as pages; sheets as a grid with a tab per sheet; slides one under another; a ZIP's folders and files. A file
 * the page can't read shows its card.
 */
function PreviewPage({
  detail,
  info,
  page: name,
  kind,
}: {
  detail: ArtifactDetail;
  info: FileInfo;
  page: PageName;
  kind?: "docx" | "sheet" | "csv" | "pptx" | "zip";
}) {
  const { t } = useTranslation();
  const orgId = useOrgId();
  const c = useColors();
  const page = usePage(name);
  const bytes = useFileBytes(orgId, detail, true);
  const web = useRef<WebView<object>>(null);
  // Counts the page's "ready"s: a page that loads again (its process restarted) gets the bytes again.
  const [ready, setReady] = useState(0);
  // Why the file shows its card instead: the page's own error, or the web view's.
  const [failed, setFailed] = useState<string | null>(null);
  const sent = useRef(false);

  useEffect(() => {
    if (ready === 0 || bytes.data === undefined || sent.current) return;
    sent.current = true;
    const msg = name === "pdf" ? { type: "pdf", data: bytes.data } : { type: "file", kind, data: bytes.data };
    web.current?.postMessage(JSON.stringify(msg));
  }, [ready, bytes.data, name, kind]);

  const uri = useMemo(() => {
    if (!page.data) return null;
    const q = new URLSearchParams({
      bg: c.sunken,
      ink: c.ink,
      muted: c.faint,
      line: c.line2,
      raised: c.raised,
      loading: t("common.loading"),
      failed: t("mobile.files.loadFailed"),
      rowsCut: t("mobile.files.rowsCut", { rows: SHEET_ROWS }),
      empty: t("mobile.files.sheetEmpty"),
      maxRows: String(SHEET_ROWS),
    });
    return `${page.data}?${q.toString()}`;
  }, [page.data, c.sunken, c.ink, c.faint, c.line2, c.raised, t]);

  const reason =
    failed ??
    (bytes.isError ? `download: ${errorText(bytes.error)}` : null) ??
    (page.isError ? `page: ${errorText(page.error)}` : null);
  if (reason !== null) return <BigCard info={info} reason={reason} />;
  return (
    <View style={[styles.page, styles.clip, { backgroundColor: c.sunken }]}>
      {uri && page.data ? (
        <WebView
          ref={web}
          source={{ uri }}
          originWhitelist={["file://*"]}
          // Only the page itself: a link inside the file never navigates the view away.
          onShouldStartLoadWithRequest={(r) => r.url.startsWith(page.data as string)}
          javaScriptEnabled
          allowFileAccess
          onError={(e) => setFailed(`view: ${e.nativeEvent.description || e.nativeEvent.code}`)}
          onMessage={(e) => {
            let msg: { type?: string; message?: string } | null = null;
            try {
              msg = JSON.parse(e.nativeEvent.data) as { type?: string; message?: string };
            } catch {
              return;
            }
            if (msg?.type === "ready") {
              sent.current = false;
              setReady((n) => n + 1);
            } else if (msg?.type === "error") setFailed(`page: ${msg.message ?? ""}`);
          }}
          style={styles.web}
        />
      ) : (
        <Center>
          <ActivityIndicator color={c.faint} />
        </Center>
      )}
    </View>
  );
}

/** An audio file: the video player playing sound alone, the file's tile in the middle. */
function AudioPage({ detail, info }: { detail: ArtifactDetail; info: FileInfo }) {
  const orgId = useOrgId();
  const c = useColors();
  const link = useRemoteFile(orgId, detail.id, detail.shownVersion);
  const [failed, setFailed] = useState(false);
  const source = useMemo(
    () => (link.data ? { uri: link.data.uri, ...(link.data.headers ? { headers: link.data.headers } : {}) } : null),
    [link.data],
  );
  const cover = useMemo(() => ({ cover: <FileTile ext={info.ext} size="lg" /> }), [info.ext]);
  if (failed || link.isError) return <BigCard info={info} />;
  return (
    <View style={[styles.page, styles.clip, styles.picture]}>
      {source ? (
        <VideoPlayer
          key={source.uri}
          variant="screen"
          source={source}
          name={info.name}
          audio={cover}
          onFailed={() => setFailed(true)}
        />
      ) : (
        <Center>
          <ActivityIndicator color={c.faint} />
        </Center>
      )}
    </View>
  );
}

/** A picture, whole on the page (the picture viewer, with its zoom, opens from the chat and the Drive's cards). */
function ImagePage({ detail, info }: { detail: ArtifactDetail; info: FileInfo }) {
  const orgId = useOrgId();
  const c = useColors();
  const link = useRemoteFile(orgId, detail.id, detail.shownVersion);
  const [failed, setFailed] = useState(false);
  if (failed || link.isError) return <BigCard info={info} />;
  return (
    <View style={[styles.page, styles.clip, styles.picture, { backgroundColor: c.sunken }]}>
      {link.data ? (
        <Image
          source={{ uri: link.data.uri, headers: link.data.headers, cacheKey: `${detail.id}@${detail.shownVersion}` }}
          contentFit="contain"
          transition={160}
          style={StyleSheet.absoluteFill}
          onError={() => setFailed(true)}
          accessibilityLabel={info.name}
        />
      ) : (
        <Center>
          <ActivityIndicator color={c.faint} />
        </Center>
      )}
    </View>
  );
}

/** A video, filling the screen between the top and the bar; one this phone can't play shows its card. */
function VideoPage({ detail, info }: { detail: ArtifactDetail; info: FileInfo }) {
  const orgId = useOrgId();
  const c = useColors();
  const link = useRemoteFile(orgId, detail.id, detail.shownVersion);
  const [failed, setFailed] = useState(false);
  const source = useMemo(
    () => (link.data ? { uri: link.data.uri, ...(link.data.headers ? { headers: link.data.headers } : {}) } : null),
    [link.data],
  );
  if (failed || link.isError) return <BigCard info={info} />;
  return (
    <View style={[styles.page, styles.clip, styles.video]}>
      {source ? (
        <VideoPlayer
          key={source.uri}
          variant="screen"
          source={source}
          name={info.name}
          onFailed={() => setFailed(true)}
        />
      ) : (
        <Center>
          <ActivityIndicator color={c.faint} />
        </Center>
      )}
    </View>
  );
}

/** An error's words for the card's small print. */
const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * A type the app doesn't draw: its card, big, and Compartilhar opens it elsewhere. A preview that failed adds why, in
 * small print (selectable, so it can be copied into a bug report).
 */
function BigCard({ info, reason }: { info: FileInfo; reason?: string }) {
  const { t } = useTranslation();
  const c = useColors();
  const line = useFileLine();
  return (
    <Center>
      <FileTile ext={info.ext} size="lg" />
      <Text variant="title" style={styles.bigName} numberOfLines={3}>
        {info.name}
      </Text>
      <Text variant="footnote" tone="faint">
        {line(info)}
      </Text>
      <Text variant="small" tone="muted" style={styles.note}>
        {t("mobile.files.noPreview")}
      </Text>
      {reason ? (
        <RNText selectable style={[styles.reason, { color: c.faint }]}>
          {reason}
        </RNText>
      ) : null}
    </Center>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingBottom: 10 },
  spacer: { flex: 1 },
  heading: { gap: 2, paddingHorizontal: SCREEN_X, paddingBottom: 8 },
  bold: { fontWeight: "600" },
  body: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 6 },
  page: { flex: 1, marginTop: 4, marginHorizontal: 16, borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  clip: { overflow: "hidden" },
  pageInner: { paddingHorizontal: CARD_PAD, paddingTop: CARD_PAD, paddingBottom: 32 },
  mono: { fontFamily: MONO, fontSize: 13, lineHeight: 19 },
  json: { gap: 10, alignItems: "flex-start" },
  web: { flex: 1, backgroundColor: "transparent" },
  video: { backgroundColor: "#000", borderBottomLeftRadius: 14, borderBottomRightRadius: 14, marginBottom: 12 },
  picture: { borderBottomLeftRadius: 14, borderBottomRightRadius: 14, marginBottom: 12 },
  bigName: { marginTop: 14, textAlign: "center" },
  note: { marginTop: 10, textAlign: "center" },
  reason: { marginTop: 8, fontFamily: MONO, fontSize: 11, lineHeight: 15, textAlign: "center" },
  bar: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  half: { flex: 1 },
});
