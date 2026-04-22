import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Tabs } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { theme } from "@/theme";

function TabIconFrame({
  children,
  focused,
  tilt = 0,
}: {
  children: ReactNode;
  focused: boolean;
  tilt?: number;
}) {
  return (
    <View
      style={[
        styles.iconFrame,
        focused ? styles.iconFrameFocused : styles.iconFrameIdle,
        { transform: [{ rotate: `${focused ? tilt : 0}deg` }] },
      ]}
    >
      {children}
    </View>
  );
}

function RidesTabIcon({
  color,
  size,
  focused,
}: {
  color: string;
  size: number;
  focused: boolean;
}) {
  return (
    <TabIconFrame focused={focused} tilt={-4}>
      <View style={[styles.ridesIcon, { width: size + 8, height: size + 6 }]}>
        <MaterialIcons name="calendar-today" color={color} size={size} />
        <View style={styles.historyBadge}>
          <MaterialIcons name="history" color={color} size={size * 0.55} />
        </View>
      </View>
    </TabIconFrame>
  );
}

export default function RiderLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: theme.colors.offWhite,
        },
        tabBarActiveTintColor: theme.colors.orange,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarButton: HapticTab,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          ...theme.typography.monoSmall,
          marginTop: 4,
          marginBottom: 4,
        },
        tabBarIconStyle: {
          marginTop: 2,
          marginBottom: 2,
        },
        tabBarItemStyle: {
          paddingTop: 4,
        },
        tabBarStyle: {
          height: 82,
          paddingTop: 8,
          paddingBottom: 10,
          backgroundColor: theme.colors.white,
          borderTopWidth: theme.borders.thick,
          borderTopColor: theme.colors.black,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIconFrame focused={focused} tilt={3}>
              <MaterialIcons
                name={focused ? "home-filled" : "home"}
                color={color}
                size={size}
              />
            </TabIconFrame>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "Rides",
          tabBarIcon: ({ color, size, focused }) => (
            <RidesTabIcon color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: "Wallet",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIconFrame focused={focused} tilt={-3}>
              <MaterialIcons
                name="account-balance-wallet"
                color={color}
                size={size}
              />
            </TabIconFrame>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIconFrame focused={focused} tilt={2}>
              <MaterialIcons name="person-outline" color={color} size={size} />
            </TabIconFrame>
          ),
        }}
      />
      <Tabs.Screen
        name="active-trip"
        options={{
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="trip-rating"
        options={{
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconFrame: {
    width: 38,
    height: 32,
    borderRadius: theme.radii.sm,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    alignItems: "center",
    justifyContent: "center",
  },
  iconFrameFocused: {
    backgroundColor: theme.colors.orangeLight,
    ...theme.shadows.subtle,
  },
  iconFrameIdle: {
    backgroundColor: theme.colors.white,
  },
  ridesIcon: {
    alignItems: "center",
    justifyContent: "center",
  },
  historyBadge: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.white,
    borderWidth: 1.5,
    borderColor: theme.colors.black,
    alignItems: "center",
    justifyContent: "center",
  },
});
