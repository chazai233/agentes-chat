import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { haptics } from "./haptics";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

/** What a swipe does: its word and icon on the pane, the pane's color and the word's color on it. */
export interface SwipeAction {
  label: string;
  icon: IconName;
  color: string;
  ink: string;
  onAction: () => void;
}

/** The pane's width: the row opens this far, and letting go past half of it leaves it open. */
const PANE = 92;
/** Pulled at least this far, the swipe is the action itself (the system's full swipe); short of it, the row waits open. */
const FULL = 200;
/**
 * The row starts to follow only after the finger has gone this far sideways, and gives the touch back to the list as
 * soon as it has gone `GIVE_UP` up or down: a scroll that drifts a little sideways stays a scroll. (The library's
 * swipeable took the touch after 10 points sideways whatever the finger did vertically, so on Android a list of these
 * rows scrolled a little, then stuck, or opened a row instead.)
 */
const TAKE = 22;
const GIVE_UP = 10;
/** How far a fling carries the row past where the finger let go, per point per second. */
const TOSS = 0.06;
const SPRING = { damping: 26, stiffness: 320, mass: 0.8 } as const;

/** One action, or two side by side (Fixar · Silenciar), on a side. */
type Side = SwipeAction | readonly SwipeAction[] | undefined;
const actionsOf = (side: Side): readonly SwipeAction[] => (side ? ("label" in side ? [side] : side) : []);

/**
 * A list row that swipes to an action, as the system's lists do: the row follows the finger (on the UI thread),
 * revealing the action's color under all of it and its pane with the icon and the word. Letting go past half the pane
 * leaves the row open on its panes (a light tap as it catches) and a tap on a pane does it; a tap on the open row closes
 * it; pulling all the way (`FULL`) with one action on that side is the action itself. A short swipe never acts on its
 * own. `left` is revealed by swiping right, `right` by swiping left. The row's content must be opaque (it covers the
 * panes).
 */
export function SwipeRow({ left, right, children }: { left?: Side; right?: Side; children: ReactNode }) {
  const lefts = actionsOf(left);
  const rights = actionsOf(right);
  const leftWidth = PANE * lefts.length;
  const rightWidth = PANE * rights.length;
  // Where the row is (negative: moved left, showing the right panes), and where it was when the finger came down.
  const x = useSharedValue(0);
  const from = useSharedValue(0);
  const [open, setOpen] = useState(false);

  const settle = (to: number) => {
    "worklet";
    x.value = withSpring(to, SPRING);
    scheduleOnRN(setOpen, to !== 0);
  };
  const run = (action: SwipeAction | undefined) => {
    x.value = withSpring(0, SPRING);
    setOpen(false);
    if (!action) return;
    haptics.light();
    action.onAction();
  };
  const caught = () => haptics.light();

  const pan = usePanGesture({
    enabled: lefts.length + rights.length > 0,
    activeOffsetX: [-TAKE, TAKE],
    failOffsetY: [-GIVE_UP, GIVE_UP],
    maxPointers: 1,
    onActivate: () => {
      "worklet";
      from.value = x.value;
    },
    onUpdate: (e) => {
      "worklet";
      let to = from.value + e.translationX;
      // Only toward a side that has actions; past its panes at half the finger's pace, so a full pull feels heavy.
      if (to > 0) to = leftWidth === 0 ? 0 : to > leftWidth ? leftWidth + (to - leftWidth) / 2 : to;
      if (to < 0) to = rightWidth === 0 ? 0 : to < -rightWidth ? -rightWidth + (to + rightWidth) / 2 : to;
      x.value = to;
    },
    onDeactivate: (e) => {
      "worklet";
      const reach = x.value + TOSS * e.velocityX;
      if (reach > 0 && leftWidth > 0) {
        if (lefts.length === 1 && x.value >= FULL) {
          scheduleOnRN(run, lefts[0]);
          return;
        }
        if (reach > leftWidth / 2) {
          if (from.value <= 0) scheduleOnRN(caught);
          settle(leftWidth);
          return;
        }
      }
      if (reach < 0 && rightWidth > 0) {
        if (rights.length === 1 && -x.value >= FULL) {
          scheduleOnRN(run, rights[0]);
          return;
        }
        if (-reach > rightWidth / 2) {
          if (from.value >= 0) scheduleOnRN(caught);
          settle(-rightWidth);
          return;
        }
      }
      settle(0);
    },
  });

  const moved = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const leftShown = useAnimatedStyle(() => ({ opacity: x.value > 0 ? 1 : 0 }));
  const rightShown = useAnimatedStyle(() => ({ opacity: x.value < 0 ? 1 : 0 }));
  const outerLeft = lefts[lefts.length - 1];
  const outerRight = rights[rights.length - 1];

  return (
    <View style={styles.row}>
      {outerLeft ? (
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.leftSide, { backgroundColor: outerLeft.color }, leftShown]}
        >
          {lefts.map((action) => (
            <Pane key={action.label} action={action} x={x} width={leftWidth} onPress={() => run(action)} />
          ))}
        </Animated.View>
      ) : null}
      {outerRight ? (
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.rightSide, { backgroundColor: outerRight.color }, rightShown]}
        >
          {rights.map((action) => (
            <Pane key={action.label} action={action} x={x} width={rightWidth} onPress={() => run(action)} />
          ))}
        </Animated.View>
      ) : null}
      <GestureDetector gesture={pan}>
        <Animated.View style={moved}>
          {children}
          {/* Open, a tap on the row closes it instead of opening what the row leads to. */}
          {open ? (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => run(undefined)}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          ) : null}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

/** One pane: its own color, the icon and the word growing in as its side opens. */
function Pane({
  action,
  x,
  width,
  onPress,
}: {
  action: SwipeAction;
  x: SharedValue<number>;
  /** Its side's full width (all its panes). */
  width: number;
  onPress: () => void;
}) {
  const grow = useAnimatedStyle(() => {
    const k = Math.min(1, Math.abs(x.value) / width);
    return {
      opacity: interpolate(k, [0, 0.5, 1], [0, 0.6, 1]),
      transform: [{ scale: interpolate(k, [0, 1], [0.7, 1]) }],
    };
  });
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      style={({ pressed }) => [styles.pane, { backgroundColor: action.color }, pressed ? { opacity: 0.6 } : null]}
    >
      <Animated.View style={[styles.in, grow]}>
        <Icon name={action.icon} size={20} color={action.ink} />
        <Text variant="caption" numberOfLines={1} style={[styles.word, { color: action.ink }]}>
          {action.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { overflow: "hidden" },
  leftSide: { flexDirection: "row", justifyContent: "flex-start" },
  rightSide: { flexDirection: "row", justifyContent: "flex-end" },
  pane: { width: PANE, alignItems: "center", justifyContent: "center" },
  in: { alignItems: "center", gap: 4 },
  word: { fontWeight: "600" },
});
