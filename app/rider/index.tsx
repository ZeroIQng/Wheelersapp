import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Href, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";

import { AppCard } from "@/components/app-card";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { StarBurst, TriangleShape } from "@/components/decorative-shapes";
import { FloatingView, RevealView } from "@/components/motion";
import { StaticMap } from "@/components/static-map";
import { walletBalance } from "@/data/mock";
import { useRiderHistory } from "@/lib/rider-history";
import { theme } from "@/theme";

const riderServices = [
  {
    id: "book-ride",
    label: "Book ride",
    tag: "Now",
    cardColor: theme.colors.orangeLight,
    route: "/destination-search" as Href,
  },
  {
    id: "schedule-ride",
    label: "Schedule",
    tag: "Later",
    cardColor: "#FFF4CC",
    route: "/destination-search?flowMode=schedule" as Href,
  },
  {
    id: "group-ride",
    label: "Group Ride",
    tag: "Split",
    cardColor: "#E8FFF7",
    route: "/destination-search" as Href,
  },
] as const;

function ClockBadge() {
  return (
    <View style={styles.clockBadge}>
      <View style={styles.clockFace}>
        <View style={styles.clockHandVertical} />
        <View style={styles.clockHandHorizontal} />
      </View>
    </View>
  );
}

function SvgPersonOne() {
  return (
    <Svg width={34} height={88} viewBox="0 0 140 360">
      <Ellipse cx="70" cy="345" rx="34" ry="10" fill="#D9DCE5" />
      <Rect x="52" y="258" width="12" height="84" rx="6" fill="#2E3552" />
      <Rect x="77" y="258" width="12" height="84" rx="6" fill="#2E3552" />
      <Rect x="47" y="338" width="22" height="8" rx="4" fill="#1E2235" />
      <Rect x="72" y="338" width="22" height="8" rx="4" fill="#1E2235" />
      <Path d="M35 178H105L95 265H45L35 178Z" fill="#7E6AD6" />
      <Rect x="32" y="95" width="76" height="92" rx="18" fill="#F4F7FF" />
      <Rect x="14" y="106" width="18" height="86" rx="9" fill="#B97958" />
      <Rect x="108" y="106" width="18" height="70" rx="9" fill="#B97958" />
      <Rect x="16" y="105" width="16" height="72" rx="8" fill="#F4F7FF" />
      <Rect x="108" y="104" width="16" height="60" rx="8" fill="#F4F7FF" />
      <Rect x="51" y="165" width="40" height="28" rx="4" fill="#D84F6A" />
      <Rect x="61" y="82" width="16" height="18" rx="6" fill="#B97958" />
      <Circle cx="69" cy="58" r="26" fill="#B97958" />
      <Path
        d="M43 61C43 36 56 24 69 24C86 24 95 35 95 55V70H87V58C87 43 80 35 67 35C55 35 51 47 51 58V70H43V61Z"
        fill="#1F2948"
      />
      <Circle cx="61" cy="59" r="2.2" fill="#2D1F1F" />
      <Circle cx="77" cy="59" r="2.2" fill="#2D1F1F" />
    </Svg>
  );
}

function SvgPersonTwo() {
  return (
    <Svg width={34} height={88} viewBox="0 0 145 365">
      <Ellipse cx="72" cy="358" rx="36" ry="10" fill="#D9DCE5" />
      <Rect x="52" y="254" width="14" height="95" rx="7" fill="#1F2740" />
      <Rect x="80" y="254" width="14" height="95" rx="7" fill="#1F2740" />
      <Rect x="47" y="344" width="24" height="8" rx="4" fill="#161A29" />
      <Rect x="77" y="344" width="24" height="8" rx="4" fill="#161A29" />
      <Path
        d="M36 118C36 108 44 100 54 100H90C100 100 108 108 108 118V255H36V118Z"
        fill="#4964E1"
      />
      <Path d="M72 118L58 150H86L72 118Z" fill="#F9FBFF" />
      <Rect x="64" y="143" width="16" height="70" rx="7" fill="#B23949" />
      <Path d="M72 213L60 233H84L72 213Z" fill="#8E2438" />
      <Rect x="16" y="122" width="18" height="86" rx="9" fill="#A96E51" />
      <Rect x="110" y="122" width="18" height="86" rx="9" fill="#A96E51" />
      <Rect
        x="14"
        y="118"
        width="18"
        height="74"
        rx="9"
        transform="rotate(8 14 118)"
        fill="#4964E1"
      />
      <Rect
        x="110"
        y="118"
        width="18"
        height="74"
        rx="9"
        transform="rotate(-8 110 118)"
        fill="#4964E1"
      />
      <Rect x="64" y="82" width="16" height="20" rx="6" fill="#A96E51" />
      <Circle cx="72" cy="56" r="27" fill="#A96E51" />
      <Path
        d="M47 54C47 34 58 20 74 20C92 20 101 35 100 55V68H92L88 56L79 67H62L56 58L52 68H47V54Z"
        fill="#24304E"
      />
      <Path
        d="M56 61C56 77 63 86 72 86C81 86 88 77 88 61C84 70 79 74 72 74C65 74 60 70 56 61Z"
        fill="#1C2239"
      />
      <Rect
        x="56"
        y="53"
        width="12"
        height="9"
        rx="2"
        stroke="#26324F"
        strokeWidth="2"
      />
      <Rect
        x="76"
        y="53"
        width="12"
        height="9"
        rx="2"
        stroke="#26324F"
        strokeWidth="2"
      />
      <Rect x="68" y="56.5" width="8" height="2" fill="#26324F" />
    </Svg>
  );
}

function GroupRideArtwork() {
  const leftFloat = useSharedValue(0);
  const rightFloat = useSharedValue(0);

  useEffect(() => {
    leftFloat.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    rightFloat.value = withRepeat(
      withSequence(
        withTiming(-2, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [leftFloat, rightFloat]);

  const leftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: leftFloat.value }],
  }));
  const rightStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: rightFloat.value }],
  }));

  return (
    <View style={styles.groupRideArtwork}>
      <Animated.View style={[styles.groupPersonLeft, leftStyle]}>
        <View style={styles.groupPersonScale}>
          <SvgPersonOne />
        </View>
      </Animated.View>
      <Animated.View style={[styles.groupPersonRight, rightStyle]}>
        <View style={styles.groupPersonScale}>
          <SvgPersonTwo />
        </View>
      </Animated.View>
      <View style={styles.groupRideVehicle}>
        <ElectricVehicle accentColor={theme.colors.green} />
      </View>
    </View>
  );
}

function ElectricVehicle({
  accentColor,
}: {
  accentColor: string;
}) {
  return (
    <View style={styles.evWrap}>
      <View style={[styles.evBody, { backgroundColor: accentColor }]}>
        <View style={styles.evCabin} />
        <View style={styles.evWindow} />
        <View style={[styles.evBolt, { backgroundColor: theme.colors.white }]} />
        <View style={[styles.evLight, styles.evHeadlight]} />
        <View style={[styles.evLight, styles.evTaillight]} />
      </View>
      <View style={[styles.evWheel, styles.evWheelLeft]}>
        <View style={styles.evWheelHub} />
      </View>
      <View style={[styles.evWheel, styles.evWheelRight]}>
        <View style={styles.evWheelHub} />
      </View>
    </View>
  );
}

function ServiceArtwork({
  serviceId,
}: {
  serviceId: (typeof riderServices)[number]["id"];
}) {
  if (serviceId === "group-ride") {
    return <GroupRideArtwork />;
  }

  if (serviceId === "schedule-ride") {
    return (
      <View style={styles.vehicleArtwork}>
        <ElectricVehicle accentColor={theme.colors.warning} />
        <ClockBadge />
      </View>
    );
  }

  return (
    <View style={styles.vehicleArtwork}>
      <ElectricVehicle
        accentColor={theme.colors.orange}
      />
    </View>
  );
}

export default function RiderHomeScreen() {
  const router = useRouter();
  const { items: historyItems, isLoading: isLoadingHistory } = useRiderHistory(3);
  const historyPreview = historyItems.slice(0, 2);
  const expandedMapHeight = 345;
  const collapsedMapHeight = 480;
  const collapsedServiceShift = 132;
  const [historyMeasuredHeight, setHistoryMeasuredHeight] = useState<
    number | null
  >(null);
  const historyVisibility = useSharedValue(1);

  const hideHistory = () => {
    historyVisibility.value = withTiming(0, { duration: 220 });
  };

  const showHistory = () => {
    historyVisibility.value = withTiming(1, { duration: 220 });
  };

  const serviceSwipeResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 12 &&
        Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 35) {
          hideHistory();
          return;
        }

        if (gestureState.dy < -35) {
          showHistory();
        }
      },
      onPanResponderTerminate: (_, gestureState) => {
        if (gestureState.dy > 35) {
          hideHistory();
          return;
        }

        if (gestureState.dy < -35) {
          showHistory();
        }
      },
    })
  ).current;

  const historyAnimatedStyle = useAnimatedStyle(() => ({
    height:
      historyMeasuredHeight == null
        ? undefined
        : historyMeasuredHeight * historyVisibility.value,
    opacity: historyVisibility.value,
    transform: [{ translateY: (1 - historyVisibility.value) * 18 }],
    overflow: "hidden",
  }));

  const mapAnimatedStyle = useAnimatedStyle(() => ({
    height:
      expandedMapHeight +
      (1 - historyVisibility.value) * (collapsedMapHeight - expandedMapHeight),
  }));

  const serviceAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - historyVisibility.value) * collapsedServiceShift }],
  }));

  return (
    <AppScreen
      backgroundColor={theme.colors.offWhite}
      contentStyle={styles.container}
      safeAreaEdges={["top", "left", "right"]}
    >
      <StatusBar style="dark" backgroundColor="#D4E6D4" />
      <Animated.View style={[styles.mapWrap, mapAnimatedStyle]}>
        <StaticMap height={collapsedMapHeight} scene="riderHome">
          <FloatingView style={styles.triangle} distance={12} rotate={8}>
            <TriangleShape color="rgba(255,92,0,0.15)" />
          </FloatingView>
          <FloatingView
            style={styles.star}
            delay={180}
            distance={10}
            rotate={-10}
          >
            <StarBurst color="rgba(13,13,13,0.12)" width={38} height={38} />
          </FloatingView>
          <View style={styles.mapTopRow}>
            <View style={styles.titleRow}>
              <AppText variant="h2">Wheleers</AppText>
            </View>
            <View style={styles.topActions}>
              <FloatingView distance={6}>
                <Pressable
                  onPress={() => router.push("/rider/wallet" as Href)}
                  style={styles.balance}
                >
                  <AppText
                    variant="monoSmall"
                    color={theme.colors.white}
                    style={styles.balanceValue}
                  >
                    {walletBalance}
                  </AppText>
                  <AppText
                    variant="bodySmall"
                    color={theme.colors.white}
                    style={styles.balanceUnit}
                  >
                    USDT
                  </AppText>
                </Pressable>
              </FloatingView>
              <View style={styles.accountRow}>
                <Pressable
                  onPress={() => router.push("/rider/notifications" as Href)}
                  style={styles.iconButton}
                >
                  <MaterialIcons
                    name="notifications-none"
                    size={18}
                    color={theme.colors.white}
                  />
                </Pressable>
                <Pressable
                  onPress={() => router.push("/rider/profile" as Href)}
                  style={styles.profileButton}
                >
                  <AppText variant="monoSmall">CA</AppText>
                </Pressable>
              </View>
            </View>
          </View>
        </StaticMap>
      </Animated.View>

      <Animated.View
        style={[styles.serviceSection, serviceAnimatedStyle]}
        {...serviceSwipeResponder.panHandlers}
      >
        <View style={styles.swipeHandleWrap}>
          <View style={styles.swipeHandle} />
        </View>
        <RevealView delay={80}>
          <AppText
            variant="h3"
            color={theme.colors.orange}
            style={styles.serviceHeading}
          >
            Let&apos;s Wheel
          </AppText>
        </RevealView>
        <View style={styles.serviceRow}>
          {riderServices.map((service, index) => (
            <RevealView
              key={service.id}
              delay={110 + index * 60}
              style={styles.serviceSlot}
            >
              <Pressable
                onPress={() => router.push(service.route)}
                style={[
                  styles.serviceCard,
                  { backgroundColor: service.cardColor },
                  index === 1 ? styles.serviceCardRaised : null,
                ]}
              >
                <View style={styles.serviceTop}>
                  <ServiceArtwork serviceId={service.id} />
                  <View style={styles.serviceTag}>
                    <AppText variant="monoSmall" style={styles.serviceTagText}>
                      {service.tag}
                    </AppText>
                  </View>
                </View>
                <AppText
                  variant="bodyMedium"
                  color={theme.colors.black}
                  style={styles.serviceLabel}
                >
                  {service.label}
                </AppText>
              </Pressable>
            </RevealView>
          ))}
        </View>
      </Animated.View>

      <View style={styles.panelStack}>
        <View style={styles.searchPanel}>
          <Pressable
            onPress={() => router.push("/destination-search")}
            style={styles.searchBox}
          >
            <View style={styles.searchCopy}>
              <AppText variant="bodyMedium">Wheel to?</AppText>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                Search destination...
              </AppText>
            </View>
            <View style={styles.searchAction}>
              <MaterialIcons
                name="north-east"
                size={18}
                color={theme.colors.black}
              />
            </View>
          </Pressable>
        </View>

        <Animated.View style={historyAnimatedStyle}>
          <RevealView delay={180}>
            <View
              style={styles.historyPanel}
              onLayout={({ nativeEvent }) => {
                if (historyMeasuredHeight == null) {
                  setHistoryMeasuredHeight(nativeEvent.layout.height);
                }
              }}
            >
              <View style={styles.historyHeader}>
                <AppText variant="bodySmall" color={theme.colors.muted}>
                  Ride history
                </AppText>
                <Pressable onPress={() => router.push("/rider/history" as Href)}>
                  <AppText variant="monoSmall" color={theme.colors.orange}>
                    See all
                  </AppText>
                </Pressable>
              </View>
              <View style={styles.historySection}>
                {historyPreview.map((ride, index) => (
                  <RevealView key={ride.id} delay={220 + index * 70}>
                    <Pressable
                      onPress={() => router.push("/rider/history" as Href)}
                    >
                      <AppCard style={styles.historyCard}>
                        <View style={styles.historyIcon}>
                          <MaterialIcons
                            name={ride.icon as keyof typeof MaterialIcons.glyphMap}
                            size={16}
                            color={theme.colors.black}
                          />
                        </View>
                        <View style={styles.historyCopy}>
                          <AppText variant="bodyMedium">{ride.title}</AppText>
                          <AppText
                            variant="bodySmall"
                            color={theme.colors.muted}
                          >
                            {ride.meta}
                          </AppText>
                        </View>
                        <AppText variant="monoSmall" color={theme.colors.orange}>
                          {ride.fare}
                        </AppText>
                      </AppCard>
                    </Pressable>
                  </RevealView>
                ))}
                {!isLoadingHistory && historyPreview.length === 0 ? (
                  <AppText variant="bodySmall" color={theme.colors.muted}>
                    No ride history yet.
                  </AppText>
                ) : null}
              </View>
            </View>
          </RevealView>
        </Animated.View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  mapWrap: {
    flexShrink: 0,
    overflow: "hidden",
  },
  mapTopRow: {
    position: "absolute",
    top: 14,
    left: theme.spacing.gutter,
    right: theme.spacing.gutter,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  topActions: {
    alignItems: "flex-end",
    gap: theme.spacing.sm,
  },
  balance: {
    width: 72,
    height: 72,
    backgroundColor: theme.colors.orange,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.xs,
    ...theme.shadows.card,
  },
  balanceValue: {
    fontSize: 13,
    lineHeight: 16,
  },
  balanceUnit: {
    opacity: 0.92,
  },
  accountRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.orange,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.card,
  },
  profileButton: {
    minWidth: 38,
    height: 38,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.orangeLight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.sm,
    ...theme.shadows.card,
  },
  triangle: {
    position: "absolute",
    top: "22%",
    left: "18%",
  },
  star: {
    position: "absolute",
    right: "6%",
    bottom: "10%",
  },
  panelStack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -2,
    paddingHorizontal: theme.spacing.gutter,
    paddingBottom: 0,
    gap: theme.spacing.sm,
  },
  serviceSection: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 212,
    paddingHorizontal: theme.spacing.gutter,
    paddingTop: theme.spacing.sm,
    backgroundColor: theme.colors.offWhite,
    gap: theme.spacing.sm,
    zIndex: 1,
  },
  swipeHandleWrap: {
    alignItems: "center",
    marginBottom: theme.spacing.xs,
  },
  swipeHandle: {
    width: 52,
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.black,
    opacity: 0.18,
  },
  serviceHeading: {
    fontFamily: "Shrikhand_400Regular",
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: 0.1,
  },
  serviceTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    width: "100%",
  },
  serviceTag: {
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.white,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: theme.spacing.xs,
    flexShrink: 0,
  },
  serviceTagText: {
    fontSize: 10,
    lineHeight: 11,
    letterSpacing: 0.2,
  },
  serviceCardRaised: {
    transform: [{ translateY: -6 }],
  },
  serviceRow: {
    flexDirection: "row",
    marginTop: theme.spacing.xs,
    gap: theme.spacing.sm,
  },
  serviceSlot: {
    flex: 1,
  },
  serviceCard: {
    minHeight: 92,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    alignItems: "flex-start",
    justifyContent: "space-between",
    ...theme.shadows.card,
  },
  serviceLabel: {
    fontSize: 13,
    lineHeight: 16,
  },
  vehicleArtwork: {
    position: "relative",
    width: 58,
    height: 42,
  },
  groupRideArtwork: {
    position: "relative",
    width: 58,
    height: 42,
    overflow: "visible",
  },
  groupPersonLeft: {
    position: "absolute",
    top: -2,
    left: -4,
    zIndex: 3,
  },
  groupPersonRight: {
    position: "absolute",
    right: -4,
    top: -2,
    zIndex: 3,
  },
  groupPersonScale: {
    transform: [{ scale: 0.24 }],
    width: 10,
    height: 22,
    overflow: "hidden",
  },
  groupRideVehicle: {
    position: "absolute",
    left: 2,
    bottom: -1,
    zIndex: 1,
    transform: [{ scale: 0.82 }],
  },
  evWrap: {
    position: "relative",
    width: 58,
    height: 38,
    marginLeft: 0,
    marginTop: 4,
  },
  evBody: {
    position: "absolute",
    left: 6,
    right: 4,
    bottom: 8,
    height: 20,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: 10,
  },
  evCabin: {
    position: "absolute",
    left: 12,
    top: -10,
    width: 24,
    height: 12,
    borderWidth: theme.borders.thick,
    borderBottomWidth: 0,
    borderColor: theme.colors.black,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 8,
    backgroundColor: theme.colors.white,
  },
  evWindow: {
    position: "absolute",
    left: 16,
    top: -7,
    width: 16,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#D9F3FF",
    borderWidth: 1.5,
    borderColor: theme.colors.black,
  },
  evBolt: {
    position: "absolute",
    top: 4,
    left: 26,
    width: 6,
    height: 10,
    transform: [{ skewX: "-18deg" }],
    borderRadius: 1,
  },
  evLight: {
    position: "absolute",
    top: 6,
    width: 5,
    height: 7,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: theme.colors.black,
  },
  evHeadlight: {
    right: 2,
    backgroundColor: "#FFF4CC",
  },
  evTaillight: {
    left: 2,
    backgroundColor: "#FFC4C4",
  },
  evWheel: {
    position: "absolute",
    bottom: 0,
    width: 14,
    height: 14,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.black,
    alignItems: "center",
    justifyContent: "center",
  },
  evWheelLeft: {
    left: 12,
  },
  evWheelRight: {
    right: 8,
  },
  evWheelHub: {
    width: 5,
    height: 5,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.white,
  },
  clockBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.pill,
    backgroundColor: "#FFF4CC",
    alignItems: "center",
    justifyContent: "center",
  },
  clockFace: {
    width: 11,
    height: 11,
    borderWidth: 1.5,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  clockHandVertical: {
    position: "absolute",
    width: 1.5,
    height: 4,
    backgroundColor: theme.colors.black,
    top: 1.5,
  },
  clockHandHorizontal: {
    position: "absolute",
    width: 3.5,
    height: 1.5,
    backgroundColor: theme.colors.black,
    right: 1.5,
  },
  searchPanel: {
    gap: theme.spacing.sm,
  },
  historyPanel: {
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  searchBox: {
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.offWhite,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  searchCopy: {
    gap: 0,
  },
  searchAction: {
    width: 28,
    height: 28,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.orangeLight,
    alignItems: "center",
    justifyContent: "center",
  },
  historySection: {
    gap: theme.spacing.sm,
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.offWhite,
  },
  historyIcon: {
    width: 34,
    height: 34,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.orangeLight,
    alignItems: "center",
    justifyContent: "center",
  },
  historyCopy: {
    flex: 1,
    gap: 2,
  },
});
