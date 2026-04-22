import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Href, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, StyleSheet, View } from "react-native";

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
    route: "/destination-search" as Href,
  },
  {
    id: "schedule-ride",
    label: "Schedule a ride",
    icon: "schedule",
    route: "/destination-search" as Href,
  },
  {
    id: "group-ride",
    label: "Group Ride",
    icon: "people-alt",
    route: "/destination-search" as Href,
  },
] as const;

export default function RiderHomeScreen() {
  const router = useRouter();
  const historyPreview = riderHomeHistory.slice(0, 2);

  return (
    <AppScreen
      backgroundColor={theme.colors.offWhite}
      contentStyle={styles.container}
      safeAreaEdges={["top", "left", "right"]}
    >
      <StatusBar style="dark" backgroundColor="#D4E6D4" />
      <RevealView style={styles.mapWrap}>
        <StaticMap height={286} scene="riderHome">
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
      </RevealView>

      <View style={styles.panelStack}>
        <RevealView delay={80} style={styles.sectionIntro}>
          <AppText variant="h3" color={theme.colors.orange}>
            How do you want to Wheel?
          </AppText>
          <View style={styles.serviceRow}>
            {riderServices.map((service, index) => (
              <RevealView
                key={service.id}
                delay={110 + index * 60}
                style={styles.serviceSlot}
              >
                <Pressable
                  onPress={() => router.push(service.route)}
                  style={styles.serviceCard}
                >
                  <View style={styles.serviceIcon}>
                    <MaterialIcons
                      name={service.icon as any}
                      size={18}
                      color={theme.colors.black}
                    />
                  </View>
                  <AppText variant="bodySmall">{service.label}</AppText>
                </Pressable>
              </RevealView>
            ))}
          </View>
        </RevealView>

        <View style={styles.searchPanel}>
          <Pressable
            onPress={() => router.push("/destination-search")}
            style={styles.searchBox}
          >
            <View style={styles.searchCopy}>
              <AppText variant="bodyMedium">Where to?</AppText>
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

        <RevealView delay={180}>
          <View style={styles.historyPanel}>
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
                        <AppText variant="bodySmall" color={theme.colors.muted}>
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
  sectionIntro: {
    gap: theme.spacing.sm,
  },
  serviceRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  serviceSlot: {
    flex: 1,
  },
  serviceCard: {
    minHeight: 88,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    alignItems: "flex-start",
    justifyContent: "space-between",
    ...theme.shadows.card,
  },
  serviceIcon: {
    width: 34,
    height: 34,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.orangeLight,
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
