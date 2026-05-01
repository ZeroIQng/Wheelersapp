import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { AppButton } from "@/components/app-button";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { BackArrow } from "@/components/back-arrow";
import { recentPlaces } from "@/data/mock";
import {
  fetchOsmPlaceSuggestions,
  isOsmPlacesConfigured,
  type PlaceSuggestion,
} from "@/lib/osm-places";
import {
  MAX_ADDITIONAL_STOPS,
  MAX_ROUTE_STOPS,
  moveRouteStop,
  parseRideItineraryParam,
  serializeRideItinerary,
  type RideItinerary,
} from "@/lib/ride-route";
import { theme } from "@/theme";

const searchSuggestions = [
  ...recentPlaces.map((place) => ({
    id: place.id,
    title: place.name,
    subtitle: place.meta,
    icon: "history" as const,
  })),
  {
    id: "civic-center",
    title: "Civic Centre",
    subtitle: "Ozumba Mbadiwe Ave, Victoria Island",
    icon: "location-on" as const,
  },
  {
    id: "palms",
    title: "The Palms Mall",
    subtitle: "Bisway St, Lekki",
    icon: "storefront" as const,
  },
  {
    id: "airport-intl",
    title: "Murtala Muhammed International Airport",
    subtitle: "Airport Rd, Ikeja",
    icon: "flight" as const,
  },
] as const;

type ActiveField =
  | { type: "pickup" }
  | { type: "stop"; index: number };
type ScreenMode = "form" | "search";
type FlowMode = "booking" | "trip-edit";

const DRAG_SWAP_THRESHOLD = 88;

function getStopLabel(stopCount: number, index: number) {
  if (stopCount === 1) {
    return "Destination";
  }

  if (index === stopCount - 1) {
    return "Final destination";
  }

  return `Stop ${index + 1}`;
}

function getSearchHeading(activeField: ActiveField, stopCount: number) {
  if (activeField.type === "pickup") {
    return "Search pickup";
  }

  if (stopCount === 1) {
    return "Search destination";
  }

  return activeField.index === stopCount - 1
    ? "Search final destination"
    : `Search stop ${activeField.index + 1}`;
}

function getActiveSummaryLabel(activeField: ActiveField, stopCount: number) {
  if (activeField.type === "pickup") {
    return "Editing pickup";
  }

  if (stopCount === 1) {
    return "Editing destination";
  }

  return activeField.index === stopCount - 1
    ? "Editing final destination"
    : `Editing stop ${activeField.index + 1}`;
}

function formatSuggestionValue(item: PlaceSuggestion) {
  return item.subtitle ? `${item.title}, ${item.subtitle}` : item.title;
}

export default function DestinationSearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    flowMode?: string | string[];
    itinerary?: string | string[];
  }>();
  const initialItinerary = useMemo(
    () => parseRideItineraryParam(params.itinerary),
    [params.itinerary],
  );
  const flowMode: FlowMode =
    (Array.isArray(params.flowMode) ? params.flowMode[0] : params.flowMode) ===
    "trip-edit"
      ? "trip-edit"
      : "booking";
  const inputRef = useRef<TextInput>(null);
  const [mode, setMode] = useState<ScreenMode>("form");
  const [activeField, setActiveField] = useState<ActiveField>({
    type: "stop",
    index: 0,
  });
  const [pickupValue, setPickupValue] = useState(initialItinerary.pickup);
  const [routeStops, setRouteStops] = useState(initialItinerary.stops);
  const [searchQuery, setSearchQuery] = useState("");
  const [providerSuggestions, setProviderSuggestions] = useState<
    PlaceSuggestion[]
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  useEffect(() => {
    if (mode !== "search") {
      return;
    }

    const timeout = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);

    return () => clearTimeout(timeout);
  }, [activeField, mode]);

  useEffect(() => {
    if (mode !== "search") {
      setProviderSuggestions([]);
      setIsSearching(false);
      return;
    }

    if (!isOsmPlacesConfigured()) {
      setProviderSuggestions([]);
      setIsSearching(false);
      return;
    }

    const normalized = searchQuery.trim();

    if (!normalized) {
      setProviderSuggestions([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    const timeout = setTimeout(async () => {
      try {
        const suggestions = await fetchOsmPlaceSuggestions(normalized);

        if (!cancelled) {
          setProviderSuggestions(suggestions);
        }
      } catch {
        if (!cancelled) {
          setProviderSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [mode, searchQuery]);

  const fallbackSuggestions = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();

    if (!normalized) {
      return searchSuggestions.slice(0, 6);
    }

    return searchSuggestions.filter((item) => {
      return (
        item.title.toLowerCase().includes(normalized) ||
        item.subtitle.toLowerCase().includes(normalized)
      );
    });
  }, [searchQuery]);

  const shouldUseProviderResults =
    isOsmPlacesConfigured() && searchQuery.trim().length > 0;
  const filteredSuggestions = shouldUseProviderResults
    ? providerSuggestions
    : fallbackSuggestions;

  const openSearch = (field: ActiveField) => {
    setActiveField(field);
    setSearchQuery(
      field.type === "pickup" ? pickupValue : routeStops[field.index] ?? "",
    );
    setMode("search");
  };

  const handleBack = () => {
    if (mode === "search") {
      setMode("form");
      setSearchQuery("");
      return;
    }

    router.back();
  };

  const handleSuggestionPress = (value: string) => {
    if (activeField.type === "pickup") {
      setPickupValue(value);
    } else {
      setRouteStops((current) =>
        current.map((stop, index) =>
          index === activeField.index ? value : stop,
        ),
      );
    }

    setMode("form");
    setSearchQuery("");
  };

  const handleAddStop = () => {
    if (routeStops.length >= MAX_ROUTE_STOPS) {
      return;
    }

    const nextIndex = routeStops.length;
    setRouteStops((current) => [...current, ""]);
    openSearch({ type: "stop", index: nextIndex });
  };

  const handleRemoveStop = (index: number) => {
    if (routeStops.length <= 1) {
      return;
    }

    setRouteStops((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const handleReorderStop = (index: number, dy: number) => {
    const offset = Math.round(dy / DRAG_SWAP_THRESHOLD);

    if (offset === 0) {
      return;
    }

    setRouteStops((current) => {
      const nextIndex = Math.max(
        0,
        Math.min(current.length - 1, index + offset),
      );
      return moveRouteStop(current, index, nextIndex);
    });
  };

  const itinerary: RideItinerary = {
    pickup: pickupValue,
    stops: routeStops,
  };
  const filledStops = routeStops.filter((stop) => stop.trim().length > 0).length;
  const canAddStop =
    routeStops.length < MAX_ROUTE_STOPS &&
    routeStops[0]?.trim().length > 0 &&
    routeStops.every((stop) => stop.trim().length > 0);
  const isConfirmDisabled =
    !pickupValue.trim() || routeStops.some((stop) => stop.trim().length === 0);
  const serializedItinerary = serializeRideItinerary(itinerary);
  const searchHeading = getSearchHeading(activeField, routeStops.length);
  const activeSummaryLabel = getActiveSummaryLabel(
    activeField,
    routeStops.length,
  );
  const maxStopsReached = routeStops.length >= MAX_ROUTE_STOPS;

  return (
    <AppScreen
      backgroundColor={theme.colors.offWhite}
      scroll
      contentStyle={styles.container}
    >
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />

      <View style={styles.content}>
        {mode === "form" ? (
          <>
            <View style={styles.formTopBar}>
              <BackArrow onPress={handleBack} />
              <View style={styles.formTopCopy}>
                <AppText variant="monoSmall" color={theme.colors.muted}>
                  SEARCH RIDE
                </AppText>
                <AppText variant="bodySmall" color={theme.colors.muted}>
                  Set pickup, destination, and extra stops here
                </AppText>
              </View>
            </View>

            <View style={styles.formSheet}>
              <View
                style={[
                  styles.formConnector,
                  {
                    height: 44 + routeStops.length * 86,
                  },
                ]}
              />

              <SearchTriggerField
                color={theme.colors.green}
                label="Pickup"
                marker="circle"
                onPress={() => openSearch({ type: "pickup" })}
                value={pickupValue}
              />

              {routeStops.map((stop, index) => (
                <StopRouteField
                  canRemove={routeStops.length > 1}
                  isDragging={draggingIndex === index}
                  isFinal={index === routeStops.length - 1}
                  key={`route-stop-${index}`}
                  label={getStopLabel(routeStops.length, index)}
                  onPress={() => openSearch({ type: "stop", index })}
                  onRemove={() => handleRemoveStop(index)}
                  onReorder={(dy) => handleReorderStop(index, dy)}
                  onReorderEnd={() => setDraggingIndex(null)}
                  onReorderStart={() => setDraggingIndex(index)}
                  value={stop}
                />
              ))}

              <Pressable
                disabled={!canAddStop}
                onPress={handleAddStop}
                style={[
                  styles.addStopRow,
                  !canAddStop ? styles.addStopRowDisabled : null,
                ]}
              >
                <View style={styles.addStopIcon}>
                  <MaterialIcons
                    color={theme.colors.black}
                    name="add"
                    size={18}
                  />
                </View>
                <View style={styles.addStopCopy}>
                  <AppText variant="bodyMedium">
                    {maxStopsReached ? "Maximum stops reached" : "Add stop"}
                  </AppText>
                  <AppText variant="bodySmall" color={theme.colors.muted}>
                    {maxStopsReached
                      ? `Up to ${MAX_ADDITIONAL_STOPS} extra stops supported.`
                      : `Add up to ${MAX_ADDITIONAL_STOPS} extra stops before arrival.`}
                  </AppText>
                </View>
              </Pressable>
            </View>

            <View style={styles.helperBlock}>
              <View style={styles.helperChipRow}>
                <HelperChip
                  label={`${filledStops}/${routeStops.length} places set`}
                />
                <HelperChip
                  label={`${Math.max(0, routeStops.length - 1)} extra stop${routeStops.length - 1 === 1 ? "" : "s"}`}
                />
              </View>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                Enter the main destination first, then tap + to add stops. Use
                X to remove and drag the handle to reorder.
              </AppText>
            </View>

            <AppButton
              disabled={isConfirmDisabled}
              title={
                flowMode === "trip-edit" ? "Update trip route" : "Confirm route"
              }
              onPress={() => {
                if (flowMode === "trip-edit") {
                  router.replace({
                    pathname: "/rider/active-trip",
                    params: {
                      itinerary: serializedItinerary,
                    },
                  });
                  return;
                }

                router.push({
                  pathname: "/ride-selection",
                  params: {
                    itinerary: serializedItinerary,
                  },
                });
              }}
            />
          </>
        ) : (
          <>
            <View style={styles.searchHeader}>
              <BackArrow onPress={handleBack} />
              <View style={styles.searchBar}>
                <MaterialIcons
                  color={theme.colors.muted}
                  name="search"
                  size={18}
                />
                <TextInput
                  autoFocus
                  onChangeText={setSearchQuery}
                  placeholder={searchHeading}
                  placeholderTextColor="#A59B92"
                  ref={inputRef}
                  style={styles.searchInput}
                  value={searchQuery}
                />
              </View>
            </View>

            <View style={styles.activeSummary}>
              <View style={styles.summaryMarkerWrap}>
                <View
                  style={[
                    activeField.type === "pickup"
                      ? styles.markerCircle
                      : styles.markerSquare,
                    {
                      backgroundColor:
                        activeField.type === "pickup"
                          ? theme.colors.green
                          : theme.colors.orange,
                    },
                  ]}
                />
              </View>
              <View style={styles.summaryCopy}>
                <AppText variant="bodySmall" color={theme.colors.muted}>
                  {activeSummaryLabel}
                </AppText>
                <AppText variant="bodyMedium">
                  {searchQuery ||
                    (activeField.type === "pickup"
                      ? pickupValue
                      : routeStops[activeField.index] || "Search for a place")}
                </AppText>
              </View>
            </View>

            <View style={styles.routePreviewCard}>
              <AppText variant="monoSmall" color={theme.colors.muted}>
                ROUTE PREVIEW
              </AppText>
              <PreviewRow
                color={theme.colors.green}
                label="Pickup"
                value={pickupValue}
              />
              {routeStops.map((stop, index) => (
                <PreviewRow
                  color={theme.colors.orange}
                  key={`preview-stop-${index}`}
                  label={getStopLabel(routeStops.length, index)}
                  value={stop || "Not set yet"}
                />
              ))}
            </View>

            <View style={styles.resultsSection}>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                {searchQuery.trim()
                  ? isOsmPlacesConfigured()
                    ? "OpenStreetMap place results"
                    : "Suggestions"
                  : "Recent and nearby places"}
              </AppText>

              {isSearching ? (
                <View style={styles.emptyState}>
                  <AppText variant="bodyMedium">Searching places...</AppText>
                  <AppText variant="bodySmall" color={theme.colors.muted}>
                    Finding matching locations.
                  </AppText>
                </View>
              ) : filteredSuggestions.length > 0 ? (
                filteredSuggestions.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() =>
                      handleSuggestionPress(formatSuggestionValue(item))
                    }
                    style={styles.resultRow}
                  >
                    <View style={styles.resultIcon}>
                      <MaterialIcons
                        color={theme.colors.black}
                        name={item.icon}
                        size={18}
                      />
                    </View>
                    <View style={styles.resultCopy}>
                      <AppText variant="bodyMedium">{item.title}</AppText>
                      <AppText variant="bodySmall" color={theme.colors.muted}>
                        {item.subtitle}
                      </AppText>
                    </View>
                  </Pressable>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <AppText variant="bodyMedium">No places found</AppText>
                  <AppText variant="bodySmall" color={theme.colors.muted}>
                    Keep typing to search for a location.
                  </AppText>
                </View>
              )}
            </View>
          </>
        )}
      </View>
    </AppScreen>
  );
}

type SearchTriggerFieldProps = {
  color: string;
  label: string;
  marker: "circle" | "square";
  onPress: () => void;
  value: string;
};

function SearchTriggerField({
  color,
  label,
  marker,
  onPress,
  value,
}: SearchTriggerFieldProps) {
  return (
    <View style={styles.triggerFieldBlock}>
      <AppText variant="bodySmall" color={theme.colors.muted}>
        {label}
      </AppText>
      <Pressable onPress={onPress} style={styles.triggerField}>
        <View
          style={[
            marker === "circle" ? styles.markerCircle : styles.markerSquare,
            { backgroundColor: color },
          ]}
        />
        <AppText variant="body" style={styles.triggerText}>
          {value}
        </AppText>
      </Pressable>
    </View>
  );
}

type StopRouteFieldProps = {
  canRemove: boolean;
  isDragging: boolean;
  isFinal: boolean;
  label: string;
  onPress: () => void;
  onRemove: () => void;
  onReorder: (dy: number) => void;
  onReorderEnd: () => void;
  onReorderStart: () => void;
  value: string;
};

function StopRouteField({
  canRemove,
  isDragging,
  isFinal,
  label,
  onPress,
  onRemove,
  onReorder,
  onReorderEnd,
  onReorderStart,
  value,
}: StopRouteFieldProps) {
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > 4,
        onPanResponderGrant: onReorderStart,
        onPanResponderRelease: (_, gestureState) => {
          onReorder(gestureState.dy);
          onReorderEnd();
        },
        onPanResponderTerminate: onReorderEnd,
      }),
    [onReorder, onReorderEnd, onReorderStart],
  );

  return (
    <View style={styles.triggerFieldBlock}>
      <AppText variant="bodySmall" color={theme.colors.muted}>
        {label}
      </AppText>
      <View
        style={[
          styles.stopFieldRow,
          isDragging ? styles.stopFieldRowDragging : null,
        ]}
      >
        <Pressable onPress={onPress} style={styles.stopFieldPressable}>
          <View
            style={[
              styles.markerSquare,
              {
                backgroundColor: isFinal
                  ? theme.colors.orange
                  : theme.colors.orangeLight,
              },
            ]}
          />
          <AppText
            variant="body"
            color={value ? theme.colors.black : "#A59B92"}
            style={styles.triggerText}
          >
            {value || "Search for a stop"}
          </AppText>
        </Pressable>

        <View style={styles.stopFieldActions}>
          {canRemove ? (
            <Pressable onPress={onRemove} style={styles.iconButton}>
              <MaterialIcons
                color={theme.colors.black}
                name="close"
                size={18}
              />
            </Pressable>
          ) : null}
          <View
            {...panResponder.panHandlers}
            style={[styles.iconButton, styles.dragButton]}
          >
            <MaterialIcons
              color={theme.colors.black}
              name="drag-handle"
              size={18}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function PreviewRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.previewRow}>
      <View style={[styles.previewDot, { backgroundColor: color }]} />
      <View style={styles.previewCopy}>
        <AppText variant="bodySmall" color={theme.colors.muted}>
          {label}
        </AppText>
        <AppText variant="bodyMedium">{value}</AppText>
      </View>
    </View>
  );
}

function HelperChip({ label }: { label: string }) {
  return (
    <View style={styles.helperChip}>
      <AppText variant="monoSmall">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: theme.spacing.lg,
  },
  content: {
    gap: theme.spacing.lg,
  },
  formTopBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  formTopCopy: {
    flex: 1,
    gap: 2,
  },
  formSheet: {
    position: "relative",
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.white,
    ...theme.shadows.card,
  },
  formConnector: {
    position: "absolute",
    left: 27,
    top: 58,
    width: 2,
    backgroundColor: theme.colors.borderLight,
  },
  triggerFieldBlock: {
    gap: theme.spacing.xs,
  },
  triggerField: {
    minHeight: 58,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  triggerText: {
    flex: 1,
  },
  markerCircle: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
  },
  markerSquare: {
    width: 8,
    height: 8,
    borderRadius: 2,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
  },
  helperBlock: {
    gap: theme.spacing.xs,
  },
  helperChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  helperChip: {
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    backgroundColor: theme.colors.white,
  },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  searchBar: {
    flex: 1,
    minHeight: 54,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    ...theme.shadows.card,
  },
  searchInput: {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    color: theme.colors.black,
    paddingVertical: 0,
  },
  activeSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.white,
    ...theme.shadows.card,
  },
  summaryMarkerWrap: {
    width: 22,
    alignItems: "center",
  },
  summaryCopy: {
    flex: 1,
    gap: 2,
  },
  routePreviewCard: {
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.white,
    ...theme.shadows.card,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  previewDot: {
    width: 12,
    height: 12,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
  },
  previewCopy: {
    flex: 1,
    gap: 1,
  },
  resultsSection: {
    gap: theme.spacing.sm,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.white,
    ...theme.shadows.card,
  },
  resultIcon: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.orangeLight,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    alignItems: "center",
    justifyContent: "center",
  },
  resultCopy: {
    flex: 1,
    gap: 1,
  },
  emptyState: {
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  stopFieldRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: theme.spacing.sm,
  },
  stopFieldRowDragging: {
    opacity: 0.72,
  },
  stopFieldPressable: {
    flex: 1,
    minHeight: 58,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  stopFieldActions: {
    flexDirection: "row",
    gap: theme.spacing.xs,
  },
  iconButton: {
    width: 44,
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.white,
    ...theme.shadows.subtle,
  },
  dragButton: {
    backgroundColor: "#FFF4EA",
  },
  addStopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    minHeight: 64,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    backgroundColor: "#FFF4EA",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    ...theme.shadows.card,
  },
  addStopRowDisabled: {
    opacity: 0.55,
  },
  addStopIcon: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.white,
  },
  addStopCopy: {
    flex: 1,
    gap: 2,
  },
});
