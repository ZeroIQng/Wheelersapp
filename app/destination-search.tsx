import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { usePrivy } from "@privy-io/expo";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
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
  fetchGooglePlaceSuggestions,
  isGoogleMapsConfigured,
  resolvePlaceQuery,
  type PlaceSuggestion,
} from "@/lib/google-places";
import {
  readRecentPlaceSearches,
  saveRecentPlaceSearch,
} from "@/lib/place-search-history";
import type { RideEstimateResponse } from "@/lib/api";
import {
  buildInstantRideEstimate,
  serializeRideEstimate,
} from "@/lib/ride-estimate";
import {
  DEFAULT_DESTINATION_LABEL,
  DEFAULT_PICKUP_LABEL,
  MAX_ADDITIONAL_STOPS,
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
type FlowMode = "booking" | "trip-edit";

const SEARCH_DEBOUNCE_MS = 280;
const FORM_HISTORY_PREVIEW_LIMIT = 3;

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

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}

function isSamePlaceSuggestion(a: PlaceSuggestion, b: PlaceSuggestion) {
  return normalizeSearchText(a.address) === normalizeSearchText(b.address);
}

function matchesSearchQuery(place: PlaceSuggestion, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return true;
  }

  return [
    place.title,
    place.subtitle,
    place.address,
    formatSuggestionValue(place),
  ].some((part) => normalizeSearchText(part).includes(normalizedQuery));
}

function isExactSearchMatch(place: PlaceSuggestion, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return false;
  }

  return [
    place.title,
    place.address,
    formatSuggestionValue(place),
  ].some((part) => normalizeSearchText(part) === normalizedQuery);
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
      : "booking";
  const seededItinerary = useMemo(() => {
    if (flowMode === "trip-edit") {
      return initialItinerary;
    }

    const pickup =
      initialItinerary.pickup === DEFAULT_PICKUP_LABEL
        ? ""
        : initialItinerary.pickup;
    const stops = initialItinerary.stops.map((stop, index) => {
      const isOnlyDefaultDestination =
        initialItinerary.stops.length === 1 &&
        index === 0 &&
        stop === DEFAULT_DESTINATION_LABEL;
      return isOnlyDefaultDestination ? "" : stop;
    });

    return {
      pickup,
      stops: stops.length > 0 ? stops : [""],
    };
  }, [flowMode, initialItinerary]);

  const inputRef = useRef<TextInput>(null);
  const formScrollRef = useRef<ScrollView>(null);
  const [mode, setMode] = useState<ScreenMode>("form");
  const [activeField, setActiveField] = useState<ActiveField>({
    type: "stop",
    index: 0,
  });
  const [pickupValue, setPickupValue] = useState(seededItinerary.pickup);
  const [routeStops, setRouteStops] = useState(seededItinerary.stops);
  // Single shared search query — used in both form inline mode and full search mode
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [providerSuggestions, setProviderSuggestions] = useState<PlaceSuggestion[]>([]);
  const [recentPlaces, setRecentPlaces] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  // Which field is currently being edited inline in form mode
  const [activeRouteIndex, setActiveRouteIndex] = useState<number | null>(null);
  const [isSubmittingRoute, setIsSubmittingRoute] = useState(false);
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

  useEffect(() => {
    let cancelled = false;

    const loadRecentPlaces = async () => {
      const storedPlaces = await readRecentPlaceSearches();
      if (!cancelled) {
        setRecentPlaces(storedPlaces);
      }
    };

    void loadRecentPlaces();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const trimmedSearchQuery = searchQuery.trim();
  const matchingRecentPlaces = useMemo(
    () => recentPlaces.filter((place) => matchesSearchQuery(place, trimmedSearchQuery)),
    [recentPlaces, trimmedSearchQuery],
  );
  const matchingRecentPlacesPreview = useMemo(
    () => matchingRecentPlaces.slice(0, FORM_HISTORY_PREVIEW_LIMIT),
    [matchingRecentPlaces],
  );
  const hasExactRecentMatch = useMemo(
    () =>
      recentPlaces.some((place) =>
        isExactSearchMatch(place, debouncedSearchQuery),
      ),
    [debouncedSearchQuery, recentPlaces],
  );
  const shouldReuseCurrentRecentMatch = useMemo(
    () =>
      recentPlaces.some((place) =>
        isExactSearchMatch(place, searchQuery),
      ),
    [recentPlaces, searchQuery],
  );
  const recentPlacesPreview = useMemo(
    () => recentPlaces.slice(0, FORM_HISTORY_PREVIEW_LIMIT),
    [recentPlaces],
  );

  // Google place search runs whenever the current query changes.
  useEffect(() => {
    if (!isGoogleMapsConfigured()) {
      setProviderSuggestions([]);
      setIsSearching(false);
      return;
    }

    const normalized = debouncedSearchQuery.trim();

    if (!normalized) {
      setProviderSuggestions([]);
      setIsSearching(false);
      return;
    }

    if (hasExactRecentMatch) {
      setProviderSuggestions([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    void (async () => {
      try {
        const suggestions = await fetchGooglePlaceSuggestions(normalized);
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
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedSearchQuery, hasExactRecentMatch]);

  const shouldUseProviderResults =
    isGoogleMapsConfigured() &&
    trimmedSearchQuery.length > 0 &&
    !shouldReuseCurrentRecentMatch;

  const uniqueProviderSuggestions = useMemo(() => {
    const filteredSuggestions = shouldUseProviderResults ? providerSuggestions : [];
    const seen = new Set<string>();
    return filteredSuggestions.filter((item) => {
      const key = `${item.id}:${item.title}:${item.subtitle}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [providerSuggestions, shouldUseProviderResults]);
  const providerResults = useMemo(
    () =>
      uniqueProviderSuggestions.filter(
        (item) =>
          !matchingRecentPlacesPreview.some((recentPlace) =>
            isSamePlaceSuggestion(recentPlace, item),
          ),
      ),
    [matchingRecentPlacesPreview, uniqueProviderSuggestions],
  );

  // ─── Open full-screen search for pickup (not editable inline) ───────────────
  const openSearch = (field: ActiveField) => {
    setActiveRouteIndex(null);
    setActiveField(field);
    setSearchQuery("");
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

  const handlePlaceSelection = (place: PlaceSuggestion) => {
    void saveRecentPlaceSearch(place)
      .then((next) => setRecentPlaces(next))
      .catch(() => {});
    handleSuggestionPress(formatSuggestionValue(place));
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
    setSearchQuery("");
    requestAnimationFrame(() => {
      formScrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  };

  const handleRemoveStop = (index: number) => {
    if (intermediateStops.length === 0) return;
    if (activeRouteIndex === index) {
      setActiveRouteIndex(null);
      setSearchQuery("");
    }
    setRouteStops((current) => current.filter((_, i) => i !== index));
  };

  const clearPickup = () => {
    setPickupValue("");
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

  const clearDestination = () => {
    handleDestinationChange("");
  };

  // Stop inline edit
  const handleStopChange = (index: number, value: string) => {
    setRouteStops((current) =>
      current.map((stop, i) => (i === index ? value : stop)),
    );
    setSearchQuery(value);
  };

  const clearStop = (index: number) => {
    handleStopChange(index, "");
  };

  const itinerary = useMemo<RideItinerary>(
    () => ({ pickup: pickupValue, stops: routeStops }),
    [pickupValue, routeStops],
  );
  const canAddStop =
    intermediateStops.length < MAX_ADDITIONAL_STOPS &&
    intermediateStops.every((stop) => stop.trim().length > 0);
  const isConfirmDisabled =
    !pickupValue.trim() ||
    !destinationValue.trim() ||
    intermediateStops.some((stop) => stop.trim().length === 0);
  const serializedItinerary = serializeRideItinerary(itinerary);
  const instantEstimate = useMemo(
    () => buildInstantRideEstimate(itinerary),
    [itinerary],
  );
  const searchHeading = getSearchHeading(activeField);
  const activeSummaryLabel = getActiveSummaryLabel(activeField);
  const maxStopsReached = intermediateStops.length >= MAX_ADDITIONAL_STOPS;
  const hasExtraStops = intermediateStops.length > 0;

  // Show results panel in form mode whenever a route field is focused
  const showInlineResults = activeRouteIndex != null;
  const isCondensedForm = showInlineResults || hasExtraStops;
  const isUltraCondensedForm = showInlineResults || intermediateStops.length > 1;
  const shouldShowIdleHistory = !showInlineResults && recentPlacesPreview.length > 0;
  const firstIncompleteStopIndex = intermediateStops.findIndex(
    (stop) => stop.trim().length === 0,
  );

  const focusInlineField = (index: number) => {
    setActiveRouteIndex(index);
    setSearchQuery("");
    requestAnimationFrame(() => {
      formScrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  };

  const handleConfirmRoute = async () => {
    if (!pickupValue.trim()) {
      openSearch({ type: "pickup" });
      return;
    }

    if (firstIncompleteStopIndex >= 0) {
      focusInlineField(firstIncompleteStopIndex);
      return;
    }

    if (!destinationValue.trim()) {
      focusInlineField(routeStops.length - 1);
      return;
    }

    if (flowMode === "trip-edit") {
      setIsSubmittingRoute(true);
      try {
        await updateRideRoute(itinerary);
        router.replace({
          pathname: "/rider/active-trip",
          params: { itinerary: serializedItinerary },
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not update the ride route.";
        Alert.alert("Route update failed", message);
      } finally {
        setIsSubmittingRoute(false);
      }
      return;
    }

    router.push({
      pathname: "/ride-selection",
      params: {
        itinerary: serializedItinerary,
        estimate: serializeRideEstimate(prefetchedEstimate ?? instantEstimate),
      },
    });
  };

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
    setPrefetchedEstimate(null);

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
    }, 35);

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
              contentContainerStyle={[
                styles.formScrollContent,
                isCondensedForm ? styles.formScrollContentCondensed : null,
                isUltraCondensedForm ? styles.formScrollContentCompact : null,
              ]}
              keyboardShouldPersistTaps="handled"
              ref={formScrollRef}
              showsVerticalScrollIndicator={false}
            >
              {/* Form card */}
              <View
                style={[
                  styles.formSheet,
                  isCondensedForm ? styles.formSheetDense : null,
                  isCondensedForm ? styles.formSheetCondensed : null,
                  isUltraCondensedForm ? styles.formSheetCompact : null,
                ]}
              >
                <View
                  style={[
                    styles.formConnector,
                    isCondensedForm ? styles.formConnectorDense : null,
                    isCondensedForm ? styles.formConnectorCondensed : null,
                    {
                      height: isUltraCondensedForm
                        ? 24 + (intermediateStops.length + 1) * 58
                        : isCondensedForm
                        ? 28 + (intermediateStops.length + 1) * 68
                        : 40 + (intermediateStops.length + 1) * 78,
                    },
                  ]}
                />

                {/* Pickup — taps into full search mode */}
                <SearchTriggerField
                  dense={isCondensedForm}
                  compact={isUltraCondensedForm}
                  color={theme.colors.green}
                  label="Pickup"
                  marker="circle"
                  onClear={clearPickup}
                  onPress={() => openSearch({ type: "pickup" })}
                  value={pickupValue}
                />

                {/* Intermediate stops — inline editable */}
                {hasExtraStops
                  ? intermediateStops.map((stop, index) => (
                      <StopRouteField
                        canRemove
                        dense={isCondensedForm}
                        compact={isUltraCondensedForm}
                        isEditing={activeRouteIndex === index}
                        key={`route-stop-${index}`}
                        label={`Stop ${index + 1}`}
                        onChangeText={(value) => handleStopChange(index, value)}
                        onClear={() => clearStop(index)}
                        onFocus={() => {
                          setActiveRouteIndex(index);
                          setSearchQuery("");
                          requestAnimationFrame(() => {
                            formScrollRef.current?.scrollTo({ y: 0, animated: true });
                          });
                        }}
                        onRemove={() => handleRemoveStop(index)}
                        onSubmitEditing={() => setActiveRouteIndex(null)}
                        value={stop}
                      />
                    ))
                  : null}

                {/* Destination — inline editable */}
                <DestinationField
                  dense={isCondensedForm}
                  compact={isUltraCondensedForm}
                  isEditing={activeRouteIndex === routeStops.length - 1}
                  onClear={clearDestination}
                  onChangeText={handleDestinationChange}
                  onFocus={() => {
                    setActiveRouteIndex(routeStops.length - 1);
                    setSearchQuery("");
                    requestAnimationFrame(() => {
                      formScrollRef.current?.scrollTo({ y: 0, animated: true });
                    });
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
                    isCondensedForm ? styles.addStopRowDense : null,
                    isCondensedForm ? styles.addStopRowCompact : null,
                    isUltraCondensedForm ? styles.addStopRowUltraCompact : null,
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

              {shouldShowIdleHistory ? (
                <View style={styles.historySection}>
                  <View style={styles.sectionHeading}>
                    <AppText variant="monoSmall" color={theme.colors.muted}>
                      HISTORY
                    </AppText>
                    <AppText variant="bodySmall" color={theme.colors.muted}>
                      Recent places saved on this device
                    </AppText>
                  </View>
                  <View style={styles.resultsListContent}>
                    {recentPlacesPreview.map((item, index) => (
                      <PlaceResultRow
                        icon="history"
                        item={item}
                        key={`${item.id}-${index}-recent`}
                        onPress={() => handlePlaceSelection(item)}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

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
                  ) : matchingRecentPlacesPreview.length > 0 || providerResults.length > 0 ? (
                    <View style={styles.resultsListContent}>
                      {trimmedSearchQuery.length === 0 && matchingRecentPlacesPreview.length > 0 ? (
                        <View style={styles.sectionHeading}>
                          <AppText variant="monoSmall" color={theme.colors.muted}>
                            HISTORY
                          </AppText>
                          <AppText variant="bodySmall" color={theme.colors.muted}>
                            Recent places saved on this device
                          </AppText>
                        </View>
                      ) : null}
                      {matchingRecentPlacesPreview.map((item, index) => (
                        <PlaceResultRow
                          icon="history"
                          item={item}
                          key={`${item.id}-${index}-history`}
                          onPress={() => handlePlaceSelection(item)}
                        />
                      ))}
                      {providerResults.map((item, index) => (
                        <PlaceResultRow
                          item={item}
                          key={`${item.id}-${index}-provider`}
                          onPress={() => handlePlaceSelection(item)}
                        />
                      ))}
                    </View>
                  ) : trimmedSearchQuery.length > 0 ? (
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
            <View style={styles.footerActionBar}>
              <AppButton
                disabled={isSubmittingRoute}
                title={
                  flowMode === "trip-edit"
                    ? isSubmittingRoute
                      ? "Updating route..."
                      : "Update trip route"
                    : "Confirm route"
                }
                onPress={handleConfirmRoute}
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
                {searchQuery.length > 0 ? (
                  <Pressable
                    onPress={() => setSearchQuery("")}
                    style={styles.inlineClearButton}
                  >
                    <MaterialIcons
                      color={theme.colors.black}
                      name="close"
                      size={15}
                    />
                  </Pressable>
                ) : null}
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
                ) : matchingRecentPlacesPreview.length > 0 || providerResults.length > 0 ? (
                  <View style={styles.resultsListContent}>
                    {trimmedSearchQuery.length === 0 && matchingRecentPlacesPreview.length > 0 ? (
                      <View style={styles.sectionHeading}>
                        <AppText variant="monoSmall" color={theme.colors.muted}>
                          HISTORY
                        </AppText>
                        <AppText variant="bodySmall" color={theme.colors.muted}>
                          Recent places saved on this device
                        </AppText>
                      </View>
                    ) : null}
                    {matchingRecentPlacesPreview.map((item, index) => (
                      <PlaceResultRow
                        icon="history"
                        item={item}
                        key={`${item.id}-${index}-search-history`}
                        onPress={() => handlePlaceSelection(item)}
                      />
                    ))}
                    {providerResults.map((item, index) => (
                      <PlaceResultRow
                        item={item}
                        key={`${item.id}-${index}-search-provider`}
                        onPress={() => handlePlaceSelection(item)}
                      />
                    ))}
                  </View>
                ) : trimmedSearchQuery.length > 0 ? (
                  <View style={styles.emptyState}>
                    <AppText variant="bodyMedium">No places found</AppText>
                    <AppText variant="bodySmall" color={theme.colors.muted}>
                      Keep typing to search for a location.
                    </AppText>
                  </View>
                ) : (
                  <View style={styles.historySection}>
                    <View style={styles.sectionHeading}>
                      <AppText variant="monoSmall" color={theme.colors.muted}>
                        HISTORY
                      </AppText>
                      <AppText variant="bodySmall" color={theme.colors.muted}>
                        Recent places saved on this device
                      </AppText>
                    </View>
                    {recentPlacesPreview.length > 0 ? (
                      <View style={styles.resultsListContent}>
                        {recentPlacesPreview.map((item, index) => (
                          <PlaceResultRow
                            icon="history"
                            item={item}
                            key={`${item.id}-${index}-search-empty`}
                            onPress={() => handlePlaceSelection(item)}
                          />
                        ))}
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
  dense?: boolean;
  compact?: boolean;
  color: string;
  label: string;
  marker: "circle" | "square";
  onClear: () => void;
  onPress: () => void;
  value: string;
};

function SearchTriggerField({
  dense,
  compact,
  color,
  label,
  marker,
  onClear,
  onPress,
  value,
}: SearchTriggerFieldProps) {
  const hasValue = value.trim().length > 0;

  return (
    <View style={[styles.triggerFieldBlock, dense ? styles.triggerFieldBlockDense : null]}>
      <AppText
        variant="bodySmall"
        color={theme.colors.muted}
        style={[
          dense ? styles.fieldLabelDense : null,
          compact ? styles.fieldLabelCompact : null,
        ]}
      >
        {label}
      </AppText>
      <View
        style={[
          styles.triggerField,
          dense ? styles.triggerFieldDense : null,
          compact ? styles.triggerFieldCompact : null,
        ]}
      >
        <View
          style={[
            marker === "circle" ? styles.markerCircle : styles.markerSquare,
            { backgroundColor: color },
          ]}
        />
        <Pressable onPress={onPress} style={styles.triggerPressArea}>
          <AppText numberOfLines={1} variant="body" style={styles.triggerText}>
            {value || (
              <AppText variant="body" color={theme.colors.muted}>
                Where from?
              </AppText>
            )}
          </AppText>
        </Pressable>
        {hasValue ? (
          <Pressable onPress={onClear} style={styles.inlineClearButton}>
            <MaterialIcons color={theme.colors.black} name="close" size={15} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function PlaceResultRow({
  icon,
  item,
  onPress,
}: {
  icon?: PlaceSuggestion["icon"];
  item: PlaceSuggestion;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.resultRow}>
      <View style={styles.resultIcon}>
        <MaterialIcons
          color={theme.colors.black}
          name={icon ?? item.icon}
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
  );
}

function DestinationField({
  dense,
  compact,
  isEditing,
  onClear,
  onChangeText,
  onFocus,
  onSubmitEditing,
  value,
}: {
  dense?: boolean;
  compact?: boolean;
  isEditing: boolean;
  onClear: () => void;
  onChangeText: (value: string) => void;
  onFocus: () => void;
  onSubmitEditing: () => void;
  value: string;
}) {
  const hasValue = value.trim().length > 0;

  return (
    <View style={[styles.triggerFieldBlock, dense ? styles.triggerFieldBlockDense : null]}>
      <AppText
        variant="bodySmall"
        color={theme.colors.muted}
        style={[
          dense ? styles.fieldLabelDense : null,
          compact ? styles.fieldLabelCompact : null,
        ]}
      >
        Destination
      </AppText>
      <View
        style={[
          styles.triggerField,
          dense ? styles.triggerFieldDense : null,
          compact ? styles.triggerFieldCompact : null,
          isEditing ? styles.routeInputActive : null,
        ]}
      >
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
        {hasValue ? (
          <Pressable onPress={onClear} style={styles.inlineClearButton}>
            <MaterialIcons color={theme.colors.black} name="close" size={15} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

type StopRouteFieldProps = {
  canRemove: boolean;
  dense?: boolean;
  compact?: boolean;
  isEditing: boolean;
  label: string;
  onChangeText: (value: string) => void;
  onClear: () => void;
  onFocus: () => void;
  onRemove: () => void;
  onSubmitEditing: () => void;
  value: string;
};

function StopRouteField({
  canRemove,
  dense,
  compact,
  isEditing,
  label,
  onChangeText,
  onClear,
  onFocus,
  onRemove,
  onSubmitEditing,
  value,
}: StopRouteFieldProps) {
  const hasValue = value.trim().length > 0;

  return (
    <View style={[styles.triggerFieldBlock, dense ? styles.triggerFieldBlockDense : null]}>
      <AppText
        variant="bodySmall"
        color={theme.colors.muted}
        style={[
          dense ? styles.fieldLabelDense : null,
          compact ? styles.fieldLabelCompact : null,
        ]}
      >
        {label}
      </AppText>
      <View
        style={styles.stopFieldRow}
      >
        <View
          style={[
            styles.stopFieldPressable,
            dense ? styles.stopFieldPressableDense : null,
            compact ? styles.stopFieldPressableCompact : null,
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
          {hasValue ? (
            <Pressable onPress={onClear} style={styles.inlineClearButton}>
              <MaterialIcons color={theme.colors.black} name="close" size={15} />
            </Pressable>
          ) : null}
        </View>

        {canRemove ? (
          <Pressable
            onPress={onRemove}
            style={[
              styles.iconButton,
              dense ? styles.iconButtonDense : null,
              compact ? styles.iconButtonCompact : null,
            ]}
          >
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
  formScrollContentCondensed: {
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  formScrollContentCompact: {
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.xs,
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
  formSheetCondensed: {
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  formSheetDense: {
    gap: 6,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 10,
  },
  formSheetCompact: {
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  formConnector: {
    position: "absolute",
    left: 27,
    top: 56,
    width: 2,
    backgroundColor: theme.colors.borderLight,
  },
  formConnectorCondensed: {
    left: 23,
    top: 48,
  },
  formConnectorDense: {
    left: 23,
    top: 50,
  },
  triggerFieldBlock: {
    gap: theme.spacing.xs,
  },
  triggerFieldBlockDense: {
    gap: 4,
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
  triggerFieldCompact: {
    minHeight: 46,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  triggerFieldDense: {
    minHeight: 50,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
  },
  fieldLabelDense: {
    fontSize: 11,
    lineHeight: 14,
  },
  fieldLabelCompact: {
    fontSize: 10,
    lineHeight: 12,
  },
  triggerText: {
    flex: 1,
  },
  triggerPressArea: {
    flex: 1,
    minWidth: 0,
  },
  inlineClearButton: {
    width: 26,
    height: 26,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.white,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
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
  historySection: {
    gap: theme.spacing.sm,
  },
  sectionHeading: {
    gap: 2,
    paddingHorizontal: theme.spacing.xs,
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
  stopFieldPressableCompact: {
    minHeight: 46,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  stopFieldPressableDense: {
    minHeight: 50,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
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
  iconButtonCompact: {
    width: 40,
    minHeight: 46,
  },
  iconButtonDense: {
    width: 42,
    minHeight: 50,
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
  addStopRowCompact: {
    minHeight: 48,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  addStopRowDense: {
    minHeight: 52,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
  },
  addStopRowUltraCompact: {
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 4,
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
