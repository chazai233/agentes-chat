import { type ArtifactDetail, useApi } from "@agenteschat/client";
import { relativeDay } from "@agenteschat/client/lib/format";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking } from "react-native";
import { useToast } from "@/ui";
import { router } from "@/ui/navigation";
import { useOrgId, useWhen } from "../shared/hooks";
import { whenKind } from "../shared/logic";
import { showActionSheet } from "../shared/PickerSheet";
import { successHaptic } from "../shared/parts";
import { fileInfo } from "./logic";
import { useFileLine } from "./MessageFiles";
import { openInDrive, openWithApp, saveToDevice, saveToPhotos, shareFile } from "./source";

/**
 * One file's actions with their toasts, one at a time: Download (a copy on the phone), Open in another app, Send to…
 * (the system's share sheet with the file), Save to Photos, Sharing settings (who sees it and its link, ADR 0157) and
 * View in Drive.
 */
export function useFileActions(detail: ArtifactDetail | undefined) {
  const { t } = useTranslation();
  const api = useApi();
  const orgId = useOrgId();
  const toast = useToast();
  const line = useFileLine();
  const [busy, setBusy] = useState<"share" | "photos" | "download" | "open" | null>(null);

  const share = async () => {
    if (!detail || busy) return;
    setBusy("share");
    try {
      await shareFile(api, orgId, detail);
    } catch {
      toast({ title: t("mobile.files.shareFailed"), icon: "x" });
    } finally {
      setBusy(null);
    }
  };

  const savePhotos = async () => {
    if (!detail || busy) return;
    setBusy("photos");
    try {
      if (await saveToPhotos(api, orgId, detail)) {
        successHaptic();
        toast({ title: t("mobile.files.saved"), icon: "photos" });
      } else
        toast({
          title: t("mobile.files.photosDenied"),
          subtitle: t("mobile.files.photosDeniedSub"),
          icon: "x",
          action: { label: t("mobile.common.openSettings"), onPress: () => void Linking.openSettings() },
        });
    } catch {
      toast({ title: t("mobile.files.saveFailed"), icon: "x" });
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    if (!detail || busy) return;
    setBusy("download");
    try {
      const folder = await saveToDevice(api, orgId, detail);
      if (folder !== null) {
        successHaptic();
        toast({ title: t("mobile.files.downloaded", { folder }), icon: "download" });
      }
    } catch {
      toast({ title: t("mobile.files.downloadFailed"), icon: "x" });
    } finally {
      setBusy(null);
    }
  };

  const openWith = async () => {
    if (!detail || busy) return;
    setBusy("open");
    try {
      if (!(await openWithApp(api, orgId, detail))) toast({ title: t("mobile.files.noApp"), icon: "x" });
    } catch {
      toast({ title: t("mobile.files.loadFailed"), icon: "x" });
    } finally {
      setBusy(null);
    }
  };

  const drive = () => {
    if (!detail) return;
    openInDrive(orgId, detail).catch(() => toast({ title: t("mobile.files.loadFailed"), icon: "x" }));
  };

  const shareSheet = () => {
    if (detail) router.push({ pathname: "/file-share", params: { id: detail.id } });
  };

  /**
   * The "…" of the top bar: every action in the app's own sheet (the system's dialog on Android holds three buttons
   * and can't be closed by a tap outside), the file's name and "PDF · 2.3 MB" over them.
   */
  const more = (withPhotos: boolean) => {
    if (!detail) return;
    const info = fileInfo(detail);
    showActionSheet(
      info.name,
      [
        { label: t("mobile.files.download"), icon: "download", onPress: () => void download() },
        { label: t("mobile.files.openWith"), icon: "openApp", onPress: () => void openWith() },
        { label: t("mobile.files.sendTo"), icon: "share", onPress: () => void share() },
        ...(withPhotos
          ? [{ label: t("mobile.files.savePhotos"), icon: "photos" as const, onPress: () => void savePhotos() }]
          : []),
        ...(detail.inDrive !== false
          ? [{ label: t("mobile.files.shareSettings"), icon: "person" as const, onPress: shareSheet }]
          : []),
        { label: t("mobile.files.drive"), icon: "drive", onPress: drive },
      ],
      line(info),
    );
  };

  return { share, shareSheet, savePhotos, download, openWith, drive, more, busy };
}

/** "hoje 10:03", "ontem 18:20", "12 de out. 09:15": when the file was saved. */
export function useSavedWhen() {
  const when = useWhen();
  return (iso: string) => {
    const kind = whenKind(iso);
    const day =
      kind === "time" || kind === "yesterday" ? relativeDay(when.locale, kind === "time" ? 0 : -1) : when.short(iso);
    return `${day} ${when.time(iso)}`;
  };
}

/** The version shown was saved at… (a new version's time is the artifact's update). */
export const savedAt = (a: Pick<ArtifactDetail, "shownVersion" | "version" | "createdAt" | "updatedAt">) =>
  a.shownVersion === a.version ? a.updatedAt : a.createdAt;
