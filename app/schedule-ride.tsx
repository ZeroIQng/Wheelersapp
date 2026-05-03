import { useLocalSearchParams, useRouter } from "expo-router";
import { usePrivy } from "@privy-io/expo";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AppButton } from "@/components/app-button";
import { AppCard } from "@/components/app-card";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { BackArrow } from "@/components/back-arrow";
import { getAccessTokenWithRetry } from "@/lib/access-token";
import { parseRideEstimateParam } from "@/lib/ride-estimate";
import {
  getRideRouteRows,
  parseRideItineraryParam,
  type RideItinerary,
} from "@/lib/ride-route";
import { resolvePlaceQuery } from "@/lib/osm-places";
import { submitScheduledRide } from "@/lib/scheduled-rides";
import { theme } from "@/theme";

type ScheduleOption = {
  id: string;
  label: string;
  detail: string;
  scheduledFor: Date;
};

function buildScheduleOptions(now: Date): ScheduleOption[] {
  const inThirtyMinutes = new Date(now.getTime() + 30 * 60 * 1000);
  const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
  const tomorrowMorning = new Date(now);
  tomorrowMorning.setDate(now.getDate() + 1);
  tomorrowMorning.setHours(8, 0, 0, 0);
  const tomorrowEvening = new Date(now);
  tomorrowEvening.setDate(now.getDate() + 1);
  tomorrowEvening.setHours(18, 0, 0, 0);

  return [
    {
      id: "30m",
      label: "In 30 min",
      detail: formatDateTime(inThirtyMinutes),
      scheduledFor: inThirtyMinutes,
    },
    {
      id: "1h",
      label: "In 1 hour",
      detail: formatDateTime(inOneHour),
      scheduledFor: inOneHour,
    },
    {
      id: "tomorrow-am",
      label: "Tomorrow 8 AM",
      detail: formatDateTime(tomorrowMorning),
      scheduledFor: tomorrowMorning,
    },
    {
      id: "tomorrow-pm",
      label: "Tomorrow 6 PM",
      detail: formatDateTime(tomorrowEvening),
      scheduledFor: tomorrowEvening,
    },
  ];
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function formatUsdt(value: number | undefined): string {
  return typeof value === "number" ? `${value.toFixed(2)} USDT` : "Fare preview";
}

export default function ScheduleRideScreen() {
  const router = useRouter();
  const { getAccessToken } = usePrivy();
  const params = useLocalSearchParams<{
    itinerary?: string | string[];
    estimate?: string | string[];
  }>();
  const itinerary = useMemo(
    () => parseRideItineraryParam(params.itinerary),
    [params.itinerary],
  );
  const estimate = useMemo(
    () => parseRideEstimateParam(params.estimate),
    [params.estimate],
  );
  const routeRows = useMemo(() => getRideRouteRows(itinerary), [itinerary]);
  const scheduleOptions = useMemo(() => buildScheduleOptions(new Date()), []);
  const [selectedOptionId, setSelectedOptionId] = useState(scheduleOptions[0]?.id ?? "30m");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedOption =
    scheduleOptions.find((option) => option.id === selectedOptionId) ?? scheduleOptions[0];

  async function handleScheduleRide(): Promise<void> {
    if (!selectedOption) {
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const destinationLabel = itinerary.stops[itinerary.stops.length - 1];
      if (!destinationLabel) {
        throw new Error("Destination is required before scheduling.");
      }

      const [pickup, destination, ...stops] = await Promise.all([
        resolvePlaceQuery(itinerary.pickup),
        resolvePlaceQuery(destinationLabel),
        ...itinerary.stops.slice(0, -1).map((stop) => resolvePlaceQuery(stop)),
      ]);

      await submitScheduledRide({
        getAccessToken,
        scheduledFor: selectedOption.scheduledFor.toISOString(),
        pickup,
        destination,
        stops,
      });

      router.replace({
        pathname: "/rider/history",
        params: { tab: "scheduled" },
      });
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not schedule this ride.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppScreen
      backgroundColor={theme.colors.offWhite}
      scroll
      contentStyle={styles.container}
    >
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />

      <View style={styles.headerRow}>
        <BackArrow onPress={() => router.back()} />
        <View style={styles.headerCopy}>
          <AppText variant="monoSmall" color={theme.colors.orange}>
            SCHEDULE RIDE
          </AppText>
          <AppText variant="h2">Pick a future pickup time</AppText>
          <AppText variant="bodySmall" color={theme.colors.muted}>
            Uber-style flow: store the trip now, dispatch it into live matching closer to pickup.
          </AppText>
        </View>
      </View>

      <AppCard style={styles.summaryCard}>
        <View style={styles.metricRow}>
          <MetricPill
            label={
              estimate
                ? `${Math.max(1, Math.ceil(estimate.plannedDurationSeconds / 60))} min trip`
                : "Route ready"
            }
          />
          <MetricPill
            label={
              estimate
                ? `${estimate.plannedDistanceKm.toFixed(1)} km route`
                : "Saved route"
            }
            muted
          />
        </View>
        <AppText variant="h3">Wheeler Reserve</AppText>
        <AppText variant="bodySmall" color={theme.colors.muted}>
          {estimate
            ? `Estimated fare ${formatUsdt(estimate.fareEstimateUsdt)}`
            : "Route estimate will refresh when the scheduled ride is created."}
        </AppText>
      </AppCard>

      <AppCard style={styles.routeCard}>
        {routeRows.map((row) => (
          <View key={row.id} style={styles.routeRow}>
            <AppText variant="monoSmall" color={theme.colors.muted}>
              {row.label}
            </AppText>
            <AppText variant="bodyMedium">{row.value}</AppText>
          </View>
        ))}
      </AppCard>

      <View style={styles.optionsSection}>
        <AppText variant="monoSmall" color={theme.colors.muted}>
          PICKUP TIME
        </AppText>
        <View style={styles.optionsGrid}>
          {scheduleOptions.map((option) => {
            const selected = option.id === selectedOptionId;
            return (
              <Pressable
                key={option.id}
                onPress={() => setSelectedOptionId(option.id)}
                style={[
                  styles.optionCard,
                  selected ? styles.optionCardSelected : null,
                ]}
              >
                <AppText variant="bodyMedium">{option.label}</AppText>
                <AppText variant="bodySmall" color={theme.colors.muted}>
                  {option.detail}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {submitError ? (
        <AppText variant="bodySmall" color={theme.colors.danger}>
          {submitError}
        </AppText>
      ) : null}

      <AppButton
        title={isSubmitting ? "Scheduling ride..." : "Schedule this ride"}
        onPress={() => void handleScheduleRide()}
        disabled={isSubmitting || !selectedOption}
      />
    </AppScreen>
  );
}

function MetricPill({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <View
      style={[
        styles.metricPill,
        muted ? styles.metricPillMuted : styles.metricPillAccent,
      ]}
    >
      <AppText variant="monoSmall">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    gap: theme.spacing.md,
    alignItems: "flex-start",
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  summaryCard: {
    gap: theme.spacing.sm,
  },
  metricRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  metricPill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.thick,
  },
  metricPillAccent: {
    backgroundColor: theme.colors.orangeLight,
    borderColor: theme.colors.black,
  },
  metricPillMuted: {
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.black,
  },
  routeCard: {
    gap: theme.spacing.sm,
  },
  routeRow: {
    gap: 2,
  },
  optionsSection: {
    gap: theme.spacing.sm,
  },
  optionsGrid: {
    gap: theme.spacing.sm,
  },
  optionCard: {
    backgroundColor: theme.colors.white,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 4,
  },
  optionCardSelected: {
    backgroundColor: theme.colors.orangeLight,
  },
});
