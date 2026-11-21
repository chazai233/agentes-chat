import { Image, View } from "react-native";
import { MARK } from "@/agent/sprites";

/** The picture is 512 px with the tile at 56–456: shown larger and shifted, so the tile fills `size`. */
const SCALE = 512 / 400;
const INSET = 56 / 512;

/**
 * This fork's mark (a workspace without a logo of its own wears it): the white agent on its warm tile, the same
 * picture as the launch image and the app icon. `sky` (a workspace's own colors, which upstream's mark paints) is taken
 * and left aside: the mark is a picture.
 */
export function LogoMark({ size }: { size: number; sky?: unknown }) {
  const side = size * SCALE;
  return (
    <View
      style={{ width: size, height: size, overflow: "hidden" }}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Image
        source={MARK}
        style={{ position: "absolute", left: -INSET * side, top: -INSET * side, width: side, height: side }}
        fadeDuration={0}
      />
    </View>
  );
}
