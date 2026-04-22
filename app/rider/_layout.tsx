import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { theme } from "@/theme";

function RidesTabIcon({
  color,
  size,
}: {
  color: string;
  size: number;
}) {
  return (
    <View style={[styles.ridesIcon, { width: size + 8, height: size + 6 }]}>
      <MaterialIcons name="calendar-today" color={color} size={size} />
      <View style={[styles.historyBadge, { borderColor: theme.colors.white }]}>
        <MaterialIcons name="history" color={color} size={size * 0.55} />
      </View>
    </View>
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
          marginBottom: 4,
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
            <MaterialIcons
              name={focused ? "home-filled" : "home"}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "Rides",
          tabBarIcon: ({ color, size }) => (
            <RidesTabIcon color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: "Wallet",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons
              name="account-balance-wallet"
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person-outline" color={color} size={size} />
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
  ridesIcon: {
    alignItems: "center",
    justifyContent: "center",
  },
  historyBadge: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.colors.white,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});
