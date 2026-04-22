import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Href, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { AppCard } from "@/components/app-card";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { StarBurst, TriangleShape } from "@/components/decorative-shapes";
import { FloatingView, RevealView } from "@/components/motion";
import { StaticMap } from "@/components/static-map";
import { riderHomeHistory, walletBalance } from "@/data/mock";
import { theme } from "@/theme";

const riderServices = [
  {
    id: "book-ride",
    label: "Book ride",
    icon: "local-taxi",
    tag: "Now",
    cardColor: theme.colors.orangeLight,
    badgeColor: theme.colors.orange,
    route: "/destination-search" as Href,
  },
  {
    id: "schedule-ride",
    label: "Schedule",
    icon: "event-available",
    tag: "Later",
    cardColor: "#FFF4CC",
    badgeColor: "#F59E0B",
    route: "/destination-search" as Href,
  },
  {
    id: "group-ride",
    label: "Group Ride",
    icon: "groups",
    tag: "Split",
    cardColor: "#E8FFF7",
    badgeColor: theme.colors.green,
    route: "/destination-search" as Href,
  },
] as const;

export default function RiderHomeScreen() {
  const router = useRouter();
  const historyPreview = riderHomeHistory.slice(0, 2);
  const expandedMapHeight = 345;
  const collapsedMapHeight = 480;
  const collapsedServiceShift = 104;
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
              <FloatingView style={styles.balance} distance={6}>
                <Pressable onPress={() => router.push("/rider/wallet" as Href)}>
                  <AppText variant="monoSmall">{walletBalance}</AppText>
                  <AppText variant="bodySmall" color={theme.colors.muted}>
                    USDT
                  </AppText>
                </Pressable>
              </FloatingView>
              <View style={styles.accountRow}>
                <Pressable
                  onPress={() => router.push("/rider/notifications" as Href)}
                  style={styles.iconButton}
                >
                  <AppText variant="bodySmall">🔔</AppText>
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
            Let's Wheel
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
                  <View
                    style={[
                      styles.serviceIcon,
                      { backgroundColor: service.badgeColor },
                    ]}
                  >
                    <MaterialIcons
                      name={service.icon as any}
                      size={20}
                      color={theme.colors.black}
                    />
                  </View>
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
                            name={ride.icon as any}
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
    backgroundColor: theme.colors.white,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    ...theme.shadows.card,
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
    backgroundColor: theme.colors.white,
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
  },
  serviceTag: {
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.white,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  serviceTagText: {
    fontSize: 11,
    lineHeight: 12,
    letterSpacing: 0.3,
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
    minHeight: 84,
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
  serviceIcon: {
    width: 38,
    height: 38,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
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
