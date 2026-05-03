import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AppButton } from "@/components/app-button";
import { AppCard } from "@/components/app-card";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { BackArrow } from "@/components/back-arrow";
import { MapMock } from "@/components/MapMock";
import { MetricCard } from "@/components/MetricCard";
import { StatusPill } from "@/components/StatusPill";
import { TripProgressBar } from "@/components/TripProgressBar";
import {
  estimateRide,
  getAdditionalStopCount,
  getRideRouteRows,
  parseRideItineraryParam,
  serializeRideItinerary,
} from "@/lib/ride-route";
import { useRideSession } from "@/lib/ride-session";
import { theme } from "@/theme";

function formatUsdt(value: number | undefined, fallback: string): string {
  return typeof value === "number" ? `${value.toFixed(2)} USDT` : fallback;
}

export default function RiderActiveTripScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    itinerary?: string | string[];
  }>();
  const fallbackItinerary = useMemo(
    () => parseRideItineraryParam(params.itinerary),
    [params.itinerary],
  );
  const { cancelRide, currentRide } = useRideSession();
  const itinerary = currentRide?.itinerary ?? fallbackItinerary;
  const estimate = useMemo(() => estimateRide(itinerary), [itinerary]);
  const routeRows = useMemo(() => getRideRouteRows(itinerary), [itinerary]);
  const extraStops = getAdditionalStopCount(itinerary);
  const serializedItinerary = serializeRideItinerary(itinerary);
  const nextStop =
    currentRide?.driverLocation?.nextStopAddress ?? routeRows[1]?.value ?? itinerary.stops[0];
+  const statusLabel =
+    currentRide?.status === "active"
+      ? "TRIP IN PROGRESS"
+      : currentRide?.status === "completed"
+        ? "TRIP COMPLETED"
+        : currentRide?.status === "matched"
+          ? "DRIVER EN ROUTE"
+          : currentRide?.status === "matching"
+            ? "MATCHING DRIVER"
+            : "TRIP UPDATE";
+  const statusText =
+    currentRide?.status === "active"
+      ? "Live trip in progress"
+      : currentRide?.status === "completed"
+        ? "Ride completed"
+        : currentRide?.status === "matched"
+          ? "Driver heading to your pickup"
+          : currentRide?.status === "matching"
+            ? "Waiting for a driver to accept"
+            : "Trip status unavailable";
+  const metrics = [
+    {
+      id: "eta",
+      label: currentRide?.status === "completed" ? "MIN TRIP" : "MIN LEFT",
+      value: String(
+        currentRide?.driver?.etaSeconds
+          ? Math.max(1, Math.ceil(currentRide.driver.etaSeconds / 60))
+          : currentRide?.plannedDurationSeconds
+            ? Math.max(1, Math.ceil(currentRide.plannedDurationSeconds / 60))
+            : estimate.etaMinutes + 9,
+      ),
+      accent: "orange" as const,
+    },
+    {
+      id: "distance",
+      label: currentRide?.status === "completed" ? "KM TRIP" : "KM LEFT",
+      value: (
+        currentRide?.driverLocation?.distanceToNextStopKm ??
+        currentRide?.plannedDistanceKm ??
+        estimate.distanceKm
+      ).toFixed(1),
+    },
+    {
+      id: "fare",
+      label: currentRide?.status === "completed" ? "FARE PAID" : "FARE",
+      value: formatUsdt(
+        currentRide?.completedFareUsdt ??
+          currentRide?.driver?.lockedFareUsdt ??
+          currentRide?.fareEstimateUsdt,
+        estimate.priceLabel,
+      ),
+    },
+  ];
+
+  async function handleCancelRide() {
+    try {
+      await cancelRide("rider_cancelled");
+    } finally {
+      router.replace("/rider");
+    }
+  }
 
   return (
     <AppScreen
       backgroundColor={theme.colors.offWhite}
       contentStyle={styles.container}
@@
       <View style={styles.content}>
         <View style={styles.statusRow}>
-          <StatusPill label="TRIP IN PROGRESS" variant="dark" />
+          <StatusPill label={statusLabel} variant="dark" />
           <AppText variant="monoSmall" color={theme.colors.muted}>
-            ● {statusText}
+            ● {statusText}
           </AppText>
         </View>
 
-        <TripProgressBar progress={0.45} />
+        <TripProgressBar
+          progress={
+            currentRide?.status === "completed"
+              ? 1
+              : currentRide?.status === "active"
+                ? 0.62
+                : currentRide?.status === "matched"
+                  ? 0.28
+                  : 0.14
+          }
+        />
 
         <View style={styles.metricsRow}>
           {metrics.map((metric) => (
             <MetricCard
@@
             <View style={styles.bannerCopy}>
               <AppText variant="monoSmall" color={theme.colors.muted}>
-                HEADING TO
+                {currentRide?.status === "matched" ? "DRIVER NEXT STOP" : "HEADING TO"}
               </AppText>
               <AppText variant="bodyMedium">{nextStop}</AppText>
             </View>
             <AppButton
               title="Add or change"
               variant="ghost"
+              disabled={currentRide?.status === "completed"}
               onPress={() =>
                 router.push({
                   pathname: "/destination-search",
                   params: {
@@
         <AppButton
-          title="Arrived at destination ↗"
-          onPress={() => router.push("/rider/trip-rating")}
+          title={
+            currentRide?.status === "completed"
+              ? "Rate trip ↗"
+              : currentRide?.status === "active"
+                ? "Waiting for completion"
+                : "Driver en route"
+          }
+          disabled={currentRide?.status !== "completed"}
+          onPress={() => router.push("/rider/trip-rating")}
         />
+
+        {currentRide?.status !== "completed" ? (
+          <AppButton
+            title="Cancel ride"
+            variant="danger"
+            onPress={handleCancelRide}
+          />
+        ) : null}
       </View>
     </AppScreen>
   );
 }
*** End Patch
