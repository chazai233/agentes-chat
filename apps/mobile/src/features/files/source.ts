import { type ApiClient, type ArtifactDetail, keys, useApi } from "@agenteschat/client";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Directory, File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { appHeaders, readCookie } from "@/lib/auth";
import { serverUrl } from "@/lib/server";
import { router } from "@/ui/navigation";
import { resolveDownloadUrl, type ShareSource, safeFileName, shareSource } from "./logic";

/**
 * Getting at a file's bytes: the short-lived download link (with the session when the link is ours),
 * a copy in the cache for the share sheet, Salvar em Fotos, and the Drive on the web.
 */

/** The server's links live 5 minutes; refetch a bit before. */
const LINK_STALE_MS = 4 * 60 * 1000;

export interface RemoteFile {
  uri: string;
  headers: Record<string, string>;
  /** Served by our own server (with the session), not a link signed by a storage bucket. */
  ours?: boolean;
}

async function remote(api: ApiClient, orgId: string, id: string, version?: number): Promise<RemoteFile> {
  const { url } = await api.artifacts.download(orgId, id, version);
  const r = resolveDownloadUrl(serverUrl(), url);
  return { uri: r.uri, headers: r.needsSession ? appHeaders(await readCookie()) : {}, ours: r.needsSession };
}

/**
 * Downloads a link into `file` with the app's own `fetch`. A refusal says who refused and what they said (our
 * server's error code, or the bucket's), which the native downloader's bare status doesn't.
 */
async function download(r: RemoteFile, file: File): Promise<void> {
  const res = await fetch(r.uri, { headers: r.headers, credentials: "omit" });
  if (!res.ok) {
    const said = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 300);
    const from = r.ours ? "server" : new URL(r.uri).host;
    throw new Error(`${res.status} from ${from}: ${said}`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!file.exists) file.create();
  await file.write(bytes);
}

/** The link to show a picture or a PDF (refreshed before it expires). */
export function useRemoteFile(orgId: string, id: string | null, version?: number) {
  const api = useApi();
  return useQuery({
    queryKey: ["org", orgId, "artifacts", "link", id ?? "", version ?? "latest"] as const,
    queryFn: () => remote(api, orgId, id ?? "", version),
    enabled: Boolean(id),
    staleTime: LINK_STALE_MS,
    gcTime: LINK_STALE_MS,
  });
}

/** Several artifacts at once (a message's files), sharing the cache of `useArtifact`. */
export function useArtifacts(orgId: string, refs: { id: string; version?: number }[]) {
  const api = useApi();
  return useQueries({
    queries: refs.map((r) => ({
      queryKey: keys.artifact(orgId, r.id, r.version),
      queryFn: () => api.artifacts.get(orgId, r.id, r.version),
      staleTime: r.version ? Number.POSITIVE_INFINITY : 0,
    })),
  });
}

/** The text of a Markdown or text file: what the server kept (small files) or the download. */
export async function fileText(api: ApiClient, orgId: string, a: ArtifactDetail): Promise<string> {
  if (a.content.kind === "document") return a.content.markdown;
  if (a.content.kind === "file" && a.content.text !== undefined) return a.content.text;
  const r = await remote(api, orgId, a.id, a.shownVersion);
  const res = await fetch(r.uri, { headers: r.headers, credentials: "omit" });
  if (!res.ok) throw new Error(`download ${res.status}`);
  return res.text();
}

/**
 * A file's bytes as base64, for the app's preview pages (PDF, Office, tables, ZIP): a page in a web view takes the
 * bytes by message, so it never needs the session or the network. Downloaded into the cache once per version.
 */
export function useFileBytes(orgId: string, a: ArtifactDetail | null, enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: ["org", orgId, "artifacts", "bytes", a?.id ?? "", a?.shownVersion ?? 0] as const,
    queryFn: async () => {
      const art = a as ArtifactDetail;
      const dir = new Directory(Paths.cache, "preview", `${art.id}-${art.shownVersion}`);
      dir.create({ intermediates: true, idempotent: true });
      const file = new File(dir, "file");
      if (!file.exists) {
        const r = await remote(api, orgId, art.id, art.shownVersion);
        try {
          await download(r, file);
        } catch (err) {
          // A half-written copy would be read as the file next time.
          if (file.exists) file.delete();
          throw err;
        }
      }
      const data = await file.base64();
      // An empty copy is never kept: the next open downloads again.
      if (!data) {
        file.delete();
        throw new Error("empty download");
      }
      return data;
    },
    enabled: enabled && a !== null,
    staleTime: Number.POSITIVE_INFINITY,
    // The text is large; dropped soon after the viewer closes (the file stays in the cache).
    gcTime: 30_000,
  });
}

/** A fresh folder per file under the cache, so the copy keeps its real name. */
function cacheFile(a: ArtifactDetail, name: string): File {
  const dir = new Directory(Paths.cache, "files", `${a.id}-${a.shownVersion}`);
  dir.create({ intermediates: true, idempotent: true });
  const file = new File(dir, name);
  if (file.exists) file.delete();
  return file;
}

/** A local copy of the file, with its name and extension (what the share sheet and Fotos get). */
export async function localCopy(
  api: ApiClient,
  orgId: string,
  a: ArtifactDetail,
): Promise<{ uri: string; source: ShareSource }> {
  const source = shareSource(a);
  const file = cacheFile(a, safeFileName(source.name));
  if (source.from === "text") {
    file.writeSync(source.text);
    return { uri: file.uri, source };
  }
  const r =
    source.from === "export"
      ? {
          uri: api.artifacts.fileUrl(orgId, a.id, { version: a.shownVersion, format: source.format }),
          headers: appHeaders(await readCookie()),
        }
      : await remote(api, orgId, a.id, a.shownVersion);
  await download(r, file);
  return { uri: file.uri, source };
}

/** The system share sheet with the real file (Salvar imagem, Salvar em Arquivos, other apps). */
export async function shareFile(api: ApiClient, orgId: string, a: ArtifactDetail): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error("sharing unavailable");
  const { uri, source } = await localCopy(api, orgId, a);
  // On iOS the name already carries the extension; a MIME type there would add a second one.
  await Sharing.shareAsync(
    uri,
    Platform.OS === "android" && source.mime ? { mimeType: source.mime, dialogTitle: source.name } : {},
  );
}

/** Where "Download" saves on Android: the folder the person picked once (the system's own picker), kept here. */
const downloadFolderFile = () => new File(Paths.document, "download-folder.txt");

function savedDownloadFolder(): Directory | null {
  try {
    const f = downloadFolderFile();
    const uri = f.exists ? f.textSync().trim() : "";
    return uri ? new Directory(uri) : null;
  } catch {
    return null;
  }
}

/**
 * Download: a copy of the file on the phone. Android asks once for the folder (the system's picker, Downloads
 * suggested; the app keeps access to it) and saves there from then on, again asking only when that folder is gone;
 * iPhones save through the share sheet's "Save to Files". Resolves with the folder's name, or null when the person
 * closed the picker or the sheet.
 */
export async function saveToDevice(api: ApiClient, orgId: string, a: ArtifactDetail): Promise<string | null> {
  const { uri, source } = await localCopy(api, orgId, a);
  if (Platform.OS !== "android") {
    await Sharing.shareAsync(uri);
    return null;
  }
  const bytes = await new File(uri).bytes();
  const into = async (dir: Directory) => {
    // A name already there gets the system's " (1)".
    const target = dir.createFile(source.name, source.mime || null);
    await target.write(bytes);
    return dir.name;
  };
  const saved = savedDownloadFolder();
  if (saved) {
    try {
      return await into(saved);
    } catch {
      // The folder was removed or its access taken back: ask again.
    }
  }
  let picked: Directory;
  try {
    picked = await Directory.pickDirectoryAsync(DOWNLOADS_HINT);
  } catch {
    return null;
  }
  const name = await into(picked);
  try {
    downloadFolderFile().writeSync(picked.uri);
  } catch {
    // Not remembered: the picker asks again next time.
  }
  return name;
}

/** The picker opens on the phone's Downloads (a hint: the system may start elsewhere). */
const DOWNLOADS_HINT = "content://com.android.externalstorage.documents/document/primary%3ADownload";

/**
 * Opens the file in another app on the phone (Android's "Open with", iOS's Quick Look). False when nothing on the
 * phone opens its type.
 */
export async function openWithApp(api: ApiClient, orgId: string, a: ArtifactDetail): Promise<boolean> {
  const { uri, source } = await localCopy(api, orgId, a);
  const file = new File(uri);
  const options = source.mime ? { mimeType: source.mime } : {};
  if (!(await File.canPreview(file, options))) return false;
  await File.preview(file, { ...options, title: source.name });
  return true;
}

/** Salvar em Fotos: add-only access (never reads the library). False when the person said no. */
export async function saveToPhotos(api: ApiClient, orgId: string, a: ArtifactDetail): Promise<boolean> {
  const perm = await MediaLibrary.requestPermissionsAsync(true, ["photo"]);
  if (!perm.granted) return false;
  const { uri } = await localCopy(api, orgId, a);
  await MediaLibrary.Asset.create(uri);
  return true;
}

/**
 * Ver no Drive: closes the viewer and opens the app's Drive with the file outlined (back on the Drive when the
 * viewer was opened from it).
 */
export function openInDrive(_orgId: string, a: Pick<ArtifactDetail, "id" | "shownVersion" | "version">) {
  if (router.canGoBack()) router.back();
  return new Promise<void>((resolve) =>
    setTimeout(() => {
      router.navigate({ pathname: "/drive", params: { artifact: a.id } });
      resolve();
    }, 60),
  );
}
