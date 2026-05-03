import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { usePrivy } from "@privy-io/expo";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { AppButton } from "@/components/app-button";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { BackArrow } from "@/components/back-arrow";
import { getAccessTokenWithRetry } from "@/lib/access-token";
import { getRideEstimate, isBackendConfigured } from "@/lib/api";
import {
  fetchOsmPlaceSuggestions,
  isOsmPlacesConfigured,
  resolvePlaceQuery,
  type PlaceSuggestion,
} from "@/lib/osm-places";
import type { RideEstimateResponse } from "@/lib/api";
import { serializeRideEstimate } from "@/lib/ride-estimate";
import {
  MAX_ADDITIONAL_STOPS,
  moveRouteStop,
  parseRideItineraryParam,
  serializeRideItinerary,
  type RideItinerary,
} from "@/lib/ride-route";
import { useRideSession } from "@/lib/ride-session";
import { theme } from "@/theme";

type ActiveField =
  | { type: "pickup" }
  | { type: "stop"; index: number }
  | { type: "destination" };

type ScreenMode = "form" | "search";
type FlowMode = "booking" | "trip-edit" | "schedule";

const DRAG_SWAP_THRESHOLD = 88;

function getSearchHeading(activeField: ActiveField) {
  if (activeField.type === "pickup") return "Search pickup";
  if (activeField.type === "destination") return "Search destination";
  return `Search stop ${(activeField as { type: "stop"; index: number }).index + 1}`;
}

function getActiveSummaryLabel(activeField: ActiveField) {
  if (activeField.type === "pickup") return "Editing pickup";
  if (activeField.type === "destination") return "Editing destination";
  return `Editing stop ${(activeField as { type: "stop"; index: number }).index + 1}`;
}

function formatSuggestionValue(item: { title: string; subtitle: string }) {
  return item.subtitle ? `${item.title}, ${item.subtitle}` : item.title;
}

export default function DestinationSearchScreen() {
  const router = useRouter();
  const { getAccessToken, isReady, user } = usePrivy();
  const { updateRideRoute } = useRideSession();
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
      : (Array.isArray(params.flowMode) ? params.flowMode[0] : params.flowMode) ===
          "schedule"
        ? "schedule"
      : "booking";

  const inputRef = useRef<TextInput>(null);
  const [mode, setMode] = useState<ScreenMode>("form");
  const [activeField, setActiveField] = useState<ActiveField>({
    type: "stop",
    index: 0,
  });
  const [pickupValue, setPickupValue] = useState(initialItinerary.pickup);
  const [routeStops, setRouteStops] = useState(initialItinerary.stops);
  // Single shared search query — used in both form inline mode and full search mode
  const [searchQuery, setSearchQuery] = useState("");
  const [providerSuggestions, setProviderSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  // Which field is currently being edited inline in form mode
  const [activeRouteIndex, setActiveRouteIndex] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [isSubmittingRoute, setIsSubmittingRoute] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [prefetchedEstimate, setPrefetchedEstimate] =
    useState<RideEstimateResponse | null>(null);
  const estimateRequestRef = useRef(0);

  const destinationValue = routeStops[routeStops.length - 1] ?? "";
  const intermediateStops = routeStops.slice(0, -1);

  // ─── Focus search input when entering search mode ───────────────────────────
  useEffect(() => {
    if (mode !== "search") return;
    const timeout = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timeout);
  }, [activeField, mode]);

  // ─── OSM search — runs whenever searchQuery changes, regardless of mode ─────
  // FIX: removed the isSearchActive gate that was killing OSM in form mode.
  // We always search as long as there's a query and OSM is configured.
  useEffect(() => {
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
        if (!cancelled) setProviderSuggestions(suggestions);
      } catch {
        if (!cancelled) setProviderSuggestions([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [searchQuery]); // ← only depends on searchQuery now, not isSearchActive

  const shouldUseProviderResults =
    isOsmPlacesConfigured() && searchQuery.trim().length > 0;

  const filteredSuggestions = shouldUseProviderResults ? providerSuggestions : [];

  const uniqueSuggestions = useMemo(() => {
    const seen = new Set<string>();
    return filteredSuggestions.filter((item) => {
      const key = `${item.id}:${item.title}:${item.subtitle}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [filteredSuggestions]);

  // ─── Open full-screen search for pickup (not editable inline) ───────────────
  const openSearch = (field: ActiveField) => {
    setActiveRouteIndex(null);
    setActiveField(field);
    const currentVal =
      field.type === "pickup"
        ? pickupValue
        : field.type === "destination"
        ? destinationValue
        : routeStops[(field as { type: "stop"; index: number }).index] ?? "";
    // Set query BEFORE switching mode so OSM fires immediately
    setSearchQuery(currentVal);
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

  // ─── Pick a suggestion ──────────────────────────────────────────────────────
  const handleSuggestionPress = (value: string) => {
    Keyboard.dismiss();

    if (mode === "search") {
      // Full search mode — update the field that triggered it
      if (activeField.type === "pickup") {
        setPickupValue(value);
      } else if (activeField.type === "destination") {
        setRouteStops((current) =>
          current.map((stop, index) =>
            index === current.length - 1 ? value : stop,
          ),
        );
      } else {
        const idx = (activeField as { type: "stop"; index: number }).index;
        setRouteStops((current) =>
          current.map((stop, index) => (index === idx ? value : stop)),
        );
      }
      setMode("form");
      setSearchQuery("");
      return;
    }

    // Form inline mode — update whichever stop index is active
    if (activeRouteIndex != null) {
      setRouteStops((current) =>
        current.map((stop, index) =>
          index === activeRouteIndex ? value : stop,
        ),
      );
      setActiveRouteIndex(null);
      setSearchQuery("");
    }
  };

  const handleAddStop = () => {
    if (intermediateStops.length >= MAX_ADDITIONAL_STOPS) return;
    const insertIndex = routeStops.length - 1;
    setRouteStops((current) => {
      const next = [...current];
      next.splice(insertIndex, 0, "");
      return next;
    });
    setActiveRouteIndex(insertIndex);
    // Don't clear searchQuery — let whatever was there persist
  };

  const handleRemoveStop = (index: number) => {
    if (intermediateStops.length === 0) return;
    if (activeRouteIndex === index) {
      setActiveRouteIndex(null);
      setSearchQuery("");
    }
    setRouteStops((current) => current.filter((_, i) => i !== index));
  };

  const handleReorderStop = (index: number, dy: number) => {
    const offset = Math.round(dy / DRAG_SWAP_THRESHOLD);
    if (offset === 0) return;
    setActiveRouteIndex(null);
    setSearchQuery("");
    setRouteStops((current) => {
      const lastMovableIndex = current.length - 2;
      const nextIndex = Math.max(0, Math.min(lastMovableIndex, index + offset));
      return moveRouteStop(current, index, nextIndex);
    });
  };

  // Destination inline edit
  const handleDestinationChange = (value: string) => {
    setRouteStops((current) =>
      current.map((stop, index) =>
        index === current.length - 1 ? value : stop,
      ),
    );
    setSearchQuery(value);
  };

  // Stop inline edit
  const handleStopChange = (index: number, value: string) => {
    setRouteStops((current) =>
      current.map((stop, i) => (i === index ? value : stop)),
    );
    setSearchQuery(value);
  };

  const itinerary = useMemo<RideItinerary>(
    () => ({ pickup: pickupValue, stops: routeStops }),
    [pickupValue, routeStops],
  );
  const canAddStop =
    intermediateStops.length < MAX_ADDITIONAL_STOPS &&
    destinationValue.trim().length > 0 &&
    intermediateStops.every((stop) => stop.trim().length > 0);
  const isConfirmDisabled =
    !pickupValue.trim() ||
    !destinationValue.trim() ||
    intermediateStops.some((stop) => stop.trim().length === 0);
  const serializedItinerary = serializeRideItinerary(itinerary);
  const searchHeading = getSearchHeading(activeField);
  const activeSummaryLabel = getActiveSummaryLabel(activeField);
  const maxStopsReached = intermediateStops.length >= MAX_ADDITIONAL_STOPS;
  const hasExtraStops = intermediateStops.length > 0;

  // Show results panel in form mode whenever a route field is focused
  const showInlineResults = activeRouteIndex != null;

  useEffect(() => {
    if (
      flowMode !== "booking" ||
      !isBackendConfigured() ||
      !isReady ||
      !user ||
      isConfirmDisabled
    ) {
      setPrefetchedEstimate(null);
      return;
    }

    let cancelled = false;
    const requestId = estimateRequestRef.current + 1;
    estimateRequestRef.current = requestId;

    const timeout = setTimeout(async () => {
      try {
        const destinationLabel = itinerary.stops[itinerary.stops.length - 1];
        if (!destinationLabel) {
          if (!cancelled && estimateRequestRef.current === requestId) {
            setPrefetchedEstimate(null);
          }
          return;
        }

        const accessToken = await getAccessTokenWithRetry(getAccessToken);
        if (!accessToken) {
          return;
        }

        const [pickup, destination, ...stops] = await Promise.all([
          resolvePlaceQuery(itinerary.pickup),
          resolvePlaceQuery(destinationLabel),
          ...itinerary.stops
            .slice(0, -1)
            .map((stop) => resolvePlaceQuery(stop)),
        ]);

        const estimate = await getRideEstimate({
          accessToken,
          pickup,
          destination,
          stops,
        });

        if (!cancelled && estimateRequestRef.current === requestId) {
          setPrefetchedEstimate(estimate);
        }
      } catch {
        if (!cancelled && estimateRequestRef.current === requestId) {
          setPrefetchedEstimate(null);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [
    flowMode,
    getAccessToken,
    isConfirmDisabled,
    isReady,
    itinerary,
    user,
  ]);

  return (
    <AppScreen
      backgroundColor={theme.colors.offWhite}
      scroll={false}
      contentStyle={styles.container}
    >
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />

      <View style={styles.content}>
        {mode === "form" ? (
          <View style={styles.modeLayout}>
            {/* ── Top bar ── */}
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

            {/* ── Scrollable form + results ── */}
            {/* FIX: scrollEnabled is ALWAYS true. We removed the lock that broke scroll. */}
            <ScrollView
              bounces={false}
              contentContainerStyle={styles.formScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Form card */}
              <View style={styles.formSheet}>
                <View
                  style={[
                    styles.formConnector,
                    { height: 40 + (intermediateStops.length + 1) * 78 },
                  ]}
                />

                {/* Pickup — taps into full search mode */}
                <SearchTriggerField
                  color={theme.colors.green}
                  label="Pickup"
                  marker="circle"
                  onPress={() => openSearch({ type: "pickup" })}
                  value={pickupValue}
                />

                {/* Intermediate stops — inline editable */}
                {hasExtraStops
                  ? intermediateStops.map((stop, index) => (
                      <StopRouteField
                        canRemove
                        isEditing={activeRouteIndex === index}
                        isDragging={draggingIndex === index}
                        key={`route-stop-${index}`}
                        label={`Stop ${index + 1}`}
                        onChangeText={(value) => handleStopChange(index, value)}
                        onFocus={() => {
                          setActiveRouteIndex(index);
                          setSearchQuery(stop);
                        }}
                        onRemove={() => handleRemoveStop(index)}
                        onReorder={(dy) => handleReorderStop(index, dy)}
                        onReorderEnd={() => setDraggingIndex(null)}
                        onReorderStart={() => setDraggingIndex(index)}
                        onSubmitEditing={() => setActiveRouteIndex(null)}
                        value={stop}
                      />
                    ))
                  : null}

                {/* Destination — inline editable */}
                <DestinationField
                  isEditing={activeRouteIndex === routeStops.length - 1}
                  onChangeText={handleDestinationChange}
                  onFocus={() => {
                    setActiveRouteIndex(routeStops.length - 1);
                    setSearchQuery(destinationValue);
                  }}
                  onSubmitEditing={() => setActiveRouteIndex(null)}
                  value={destinationValue}
                />

                {/* Add stop */}
                <Pressable
                  disabled={!canAddStop}
                  onPress={handleAddStop}
                  style={[
                    styles.addStopRow,
                    !canAddStop ? styles.addStopRowDisabled : null,
                  ]}
                >
                  <View style={styles.addStopIcon}>
                    <MaterialIcons color={theme.colors.black} name="add" size={18} />
                  </View>
                  <View style={styles.addStopCopy}>
                    <AppText variant="bodyMedium">
                      {maxStopsReached ? "Maximum stops reached" : "Add stop"}
                    </AppText>
                  </View>
                </Pressable>
              </View>

              {/* ── Inline results — shown when any stop/destination field is active ── */}
              {showInlineResults ? (
                <View style={styles.resultsSection}>
                  {isSearching ? (
                    <View style={styles.emptyState}>
                      <AppText variant="bodyMedium">Searching places...</AppText>
                      <AppText variant="bodySmall" color={theme.colors.muted}>
                        Finding matching locations.
                      </AppText>
                    </View>
                  ) : uniqueSuggestions.length > 0 ? (
                    /* FIX: no maxHeight cap — scroll is handled by the parent ScrollView */
                    <View style={styles.resultsListContent}>
                      {uniqueSuggestions.map((item, index) => (
                        <Pressable
                          key={`${item.id}-${index}`}
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
                      ))}
                    </View>
                  ) : searchQuery.trim().length > 0 ? (
                    <View style={styles.emptyState}>
                      <AppText variant="bodyMedium">No places found</AppText>
                      <AppText variant="bodySmall" color={theme.colors.muted}>
                        Keep typing to search for a location.
                      </AppText>
                    </View>
                  ) : (
                    <View style={styles.emptyState}>
                      <AppText variant="bodyMedium">Search Lagos addresses</AppText>
                      <AppText variant="bodySmall" color={theme.colors.muted}>
                        Start typing a street, estate, building, or bus stop.
                      </AppText>
                    </View>
                  )}
                </View>
              ) : null}
            </ScrollView>

            {/* ── Confirm button ── */}
            {submitError ? (
              <View style={styles.footerNotice}>
                <AppText variant="bodySmall" color={theme.colors.danger}>
                  {submitError}
                </AppText>
              </View>
            ) : null}
            <View style={styles.footerActionBar}>
              <AppButton
                disabled={isConfirmDisabled || isSubmittingRoute}
                title={
                  flowMode === "trip-edit"
                    ? isSubmittingRoute
                      ? "Updating route..."
                      : "Update trip route"
                    : flowMode === "schedule"
                      ? "Continue to schedule"
                    : "Confirm route"
                }
                onPress={async () => {
                  if (flowMode === "trip-edit") {
                    setSubmitError(null);
                    setIsSubmittingRoute(true);
                    try {
                      await updateRideRoute(itinerary);
                      router.replace({
                        pathname: "/rider/active-trip",
                        params: { itinerary: serializedItinerary },
                      });
                    } catch (error) {
                      setSubmitError(
                        error instanceof Error
                          ? error.message
                          : "Could not update the ride route.",
                      );
                    } finally {
                      setIsSubmittingRoute(false);
                    }
                    return;
                  }
                  if (flowMode === "schedule") {
                    setSubmitError(null);
                    router.push({
                      pathname: "/schedule-ride",
                      params: {
                        itinerary: serializedItinerary,
                        ...(prefetchedEstimate
                          ? { estimate: serializeRideEstimate(prefetchedEstimate) }
                          : {}),
                      },
                    });
                    return;
                  }
                  setSubmitError(null);
                  router.push({
                    pathname: "/ride-selection",
                    params: {
                      itinerary: serializedItinerary,
                      ...(prefetchedEstimate
                        ? { estimate: serializeRideEstimate(prefetchedEstimate) }
                        : {}),
                    },
                  });
                }}
              />
            </View>
          </View>
        ) : (
          /* ── Full search mode ── */
          <View style={styles.modeLayout}>
            <View style={styles.searchHeader}>
              <BackArrow onPress={handleBack} />
              <View style={styles.searchBar}>
                <MaterialIcons color={theme.colors.muted} name="search" size={18} />
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
                      : activeField.type === "destination"
                      ? destinationValue
                      : routeStops[
                          (activeField as { type: "stop"; index: number }).index
                        ] || "Search for a place")}
                </AppText>
              </View>
            </View>

            {/* FIX: always-scrollable results in search mode */}
            <ScrollView
              bounces={false}
              contentContainerStyle={styles.searchScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.resultsSection}>
                {isSearching ? (
                  <View style={styles.emptyState}>
                    <AppText variant="bodyMedium">Searching places...</AppText>
                    <AppText variant="bodySmall" color={theme.colors.muted}>
                      Finding matching locations.
                    </AppText>
                  </View>
                ) : uniqueSuggestions.length > 0 ? (
                  <View style={styles.resultsListContent}>
                    {uniqueSuggestions.map((item, index) => (
                      <Pressable
                        key={`${item.id}-${index}`}
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
                    ))}
                  </View>
                ) : searchQuery.trim().length > 0 ? (
                  <View style={styles.emptyState}>
                    <AppText variant="bodyMedium">No places found</AppText>
                    <AppText variant="bodySmall" color={theme.colors.muted}>
                      Keep typing to search for a location.
                    </AppText>
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <AppText variant="bodyMedium">Search Lagos addresses</AppText>
                    <AppText variant="bodySmall" color={theme.colors.muted}>
                      Start typing a street, estate, building, or bus stop.
                    </AppText>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        )}
      </View>
    </AppScreen>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

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
        <AppText numberOfLines={1} variant="body" style={styles.triggerText}>
          {value}
        </AppText>
      </Pressable>
    </View>
  );
}

function DestinationField({
  isEditing,
  onChangeText,
  onFocus,
  onSubmitEditing,
  value,
}: {
  isEditing: boolean;
  onChangeText: (value: string) => void;
  onFocus: () => void;
  onSubmitEditing: () => void;
  value: string;
}) {
  return (
    <View style={styles.triggerFieldBlock}>
      <AppText variant="bodySmall" color={theme.colors.muted}>
        Destination
      </AppText>
      <View style={[styles.triggerField, isEditing ? styles.routeInputActive : null]}>
        <View style={[styles.markerSquare, { backgroundColor: theme.colors.orange }]} />
        <TextInput
          onChangeText={onChangeText}
          onFocus={onFocus}
          onSubmitEditing={onSubmitEditing}
          placeholder="Where are you going?"
          placeholderTextColor="#A59B92"
          style={styles.destinationInput}
          value={value}
        />
      </View>
    </View>
  );
}

type StopRouteFieldProps = {
  canRemove: boolean;
  isEditing: boolean;
  isDragging: boolean;
  label: string;
  onChangeText: (value: string) => void;
  onFocus: () => void;
  onRemove: () => void;
  onReorder: (dy: number) => void;
  onReorderEnd: () => void;
  onReorderStart: () => void;
  onSubmitEditing: () => void;
  value: string;
};

function StopRouteField({
  canRemove,
  isEditing,
  isDragging,
  label,
  onChangeText,
  onFocus,
  onRemove,
  onReorder,
  onReorderEnd,
  onReorderStart,
  onSubmitEditing,
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
        <View
          style={[
            styles.stopFieldPressable,
            isEditing ? styles.routeInputActive : null,
          ]}
        >
          <View
            style={[styles.markerSquare, { backgroundColor: theme.colors.orangeLight }]}
          />
          <TextInput
            onChangeText={onChangeText}
            onFocus={onFocus}
            onSubmitEditing={onSubmitEditing}
            placeholder="Add a stop"
            placeholderTextColor="#A59B92"
            style={styles.destinationInput}
            value={value}
          />
          <View
            {...panResponder.panHandlers}
            style={[styles.inlineDragButton, styles.dragButton]}
          >
            <AppText variant="monoSmall" color={theme.colors.black}>
              =
            </AppText>
          </View>
        </View>

        {canRemove ? (
          <Pressable onPress={onRemove} style={styles.iconButton}>
            <MaterialIcons color={theme.colors.black} name="close" size={18} />
          </Pressable>
        ) : (
          <View style={styles.iconButtonPlaceholder} />
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: theme.spacing.lg,
    paddingBottom: 0,
  },
  content: {
    flex: 1,
  },
  modeLayout: {
    flex: 1,
    gap: theme.spacing.md,
    overflow: "hidden",
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
  formScrollContent: {
    flexGrow: 1,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  searchScrollContent: {
    flexGrow: 1,
    paddingBottom: theme.spacing.xl,
  },
  footerActionBar: {
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.xl,
    backgroundColor: theme.colors.offWhite,
  },
  footerNotice: {
    paddingTop: theme.spacing.sm,
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
    top: 56,
    width: 2,
    backgroundColor: theme.colors.borderLight,
  },
  triggerFieldBlock: {
    gap: theme.spacing.xs,
  },
  triggerField: {
    minHeight: 54,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
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
  destinationInput: {
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
  resultsSection: {
    gap: theme.spacing.sm,
  },
  // FIX: removed maxHeight from resultsList — parent ScrollView handles scrolling
  resultsListContent: {
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
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
    minHeight: 54,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  routeInputActive: {
    borderColor: theme.colors.orange,
    backgroundColor: "#FFF8F2",
  },
  inlineDragButton: {
    width: 32,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    borderRadius: 8,
    backgroundColor: theme.colors.white,
    flexShrink: 0,
  },
  iconButton: {
    width: 44,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.white,
    ...theme.shadows.subtle,
  },
  iconButtonPlaceholder: {
    width: 44,
  },
  dragButton: {
    backgroundColor: "#FFF4EA",
  },
  addStopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    minHeight: 58,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    backgroundColor: "#FFF4EA",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
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
  },
});
