import type { ErrorBoundaryProps } from "expo-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { reportError } from "@/lib/error-reports";
import { Button, EmptyState, Text } from "@/ui";
import { useColors } from "./hooks";
import { MONO } from "./parts";

/**
 * A screen that broke while drawing (an error thrown in render or in an effect), in place of the app closing:
 * what happened in two lines, "Tentar de novo" (draws it again), and the error's own words, small and
 * selectable. Errors outside drawing (a tap's handler) still end the app.
 */
export function ScreenError({ error, retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const words = error instanceof Error ? error.message : String(error);
  // Where it broke, for a bug report: a release build's stack is addresses in the bundle, read back with the
  // build's source map (attached to each release beside the APK).
  const where = error instanceof Error ? stackLines(error.stack) : "";
  useEffect(() => reportError(error), [error]);
  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.page, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
    >
      <EmptyState
        icon="x"
        title={t("mobile.crash.title")}
        action={<Button variant="primary" icon="undo" label={t("mobile.crash.retry")} onPress={() => void retry()} />}
      />
      {words ? (
        <View style={[styles.words, { backgroundColor: c.sunken }]}>
          <Text variant="caption" tone="muted" selectable style={styles.mono}>
            {words}
          </Text>
          {where ? (
            <Text variant="caption" tone="faint" selectable style={[styles.mono, styles.stack]}>
              {where}
            </Text>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

/** The stack's first frames, without the message line it repeats. */
export function stackLines(stack: string | undefined, max = 12): string {
  if (!stack) return "";
  return stack
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("at "))
    .slice(0, max)
    .join("\n");
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24 },
  words: { borderRadius: 14, padding: 12, marginTop: 4 },
  mono: { fontFamily: MONO },
  stack: { marginTop: 8, fontSize: 10, lineHeight: 14 },
});
