import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
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
import {
  applyReferralCode,
  getRideEstimate,
  isBackendConfigured,
} from "@/lib/api";
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

// "pickup" targets the from field; a number targets routeStops[index]
// (intermediate stops + the final destination).
type InlineTarget = "pickup" | number;
type ScreenMode = "launcher" | "form";
type FlowMode = "booking" | "trip-edit";

const SEARCH_DEBOUNCE_MS = 280;
const FORM_HISTORY_PREVIEW_LIMIT = 3;

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
  const { getAccessToken, isReady, user } = useAuth();
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

  const formScrollRef = useRef<ScrollView>(null);
  const searchInputRef = useRef<TextInput>(null);
  // trip-edit starts straight in the editor; booking starts on the launcher.
  const [mode, setMode] = useState<ScreenMode>(
    flowMode === "trip-edit" ? "form" : "launcher",
  );
  const [pickupValue, setPickupValue] = useState(seededItinerary.pickup);
  const [routeStops, setRouteStops] = useState(seededItinerary.stops);
  // Single shared search query — drives the inline results for whichever field is active.
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [providerSuggestions, setProviderSuggestions] = useState<PlaceSuggestion[]>([]);
  const [recentPlaces, setRecentPlaces] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  // Which field is currently being edited inline on the editor page.
  const [activeInline, setActiveInline] = useState<InlineTarget | null>(null);
  const [isSubmittingRoute, setIsSubmittingRoute] = useState(false);
  const [prefetchedEstimate, setPrefetchedEstimate] =
    useState<RideEstimateResponse | null>(null);
  const [referralCode, setReferralCode] = useState("");
  const [isApplyingReferral, setIsApplyingReferral] = useState(false);
  const [referralMessage, setReferralMessage] = useState<string | null>(null);
  const [referralApplied, setReferralApplied] = useState(false);
  const estimateRequestRef = useRef(0);

  const destinationValue = routeStops[routeStops.length - 1] ?? "";
  const intermediateStops = routeStops.slice(0, -1);
  const destinationIndex = routeStops.length - 1;

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

  // ─── Navigation between launcher (page 1) and search editor (page 2) ─────
  const focusInlineField = (target: InlineTarget) => {
    setActiveInline(target);
    setSearchQuery("");

    requestAnimationFrame(() => {
      formScrollRef.current?.scrollTo({ y: 0, animated: true });
      searchInputRef.current?.focus();
    });
  };

  const openEditor = (target: InlineTarget = destinationIndex) => {
    setMode("form");
    focusInlineField(target);
  };

  const handleBack = () => {
    if (mode === "form" && flowMode === "booking") {
      setMode("launcher");
      setActiveInline(null);
      setSearchQuery("");
      Keyboard.dismiss();
      return;
    }

    router.back();
  };

  const writeRouteValue = (
    target: InlineTarget,
    value: string,
    pickup = pickupValue,
    stops = routeStops,
  ) => {
    if (target === "pickup") {
      return { pickup: value, stops };
    }

    return {
      pickup,
      stops: stops.map((stop, index) => (index === target ? value : stop)),
    };
  };

  const findFirstIncompleteTarget = (
    pickup = pickupValue,
    stops = routeStops,
  ): InlineTarget | null => {
    if (!pickup.trim()) return "pickup";

    const emptyStopIndex = stops
      .slice(0, -1)
      .findIndex((stop) => stop.trim().length === 0);

    if (emptyStopIndex >= 0) return emptyStopIndex;

    const finalDestinationIndex = stops.length - 1;
    if (!stops[finalDestinationIndex]?.trim()) return finalDestinationIndex;

    return null;
  };

  const getLauncherTarget = () => {
    const missingTarget = findFirstIncompleteTarget();
    return missingTarget ?? destinationIndex;
  };

  const handleSearchQueryChange = (value: string) => {
    setSearchQuery(value);
  };

  const handleClearActiveSearch = () => {
    setSearchQuery("");
  };

  const clearRouteField = (target: InlineTarget) => {
    if (target === "pickup") {
      setPickupValue("");
    } else {
      setRouteStops((current) =>
        current.map((stop, index) => (index === target ? "" : stop)),
      );
    }

    if (activeInline === target) {
      setSearchQuery("");
    }
  };

  const handleSuggestionPress = (value: string) => {
    const target = activeInline ?? destinationIndex;
    const nextRoute = writeRouteValue(target, value);

    Keyboard.dismiss();
    setPickupValue(nextRoute.pickup);
    setRouteStops(nextRoute.stops);
    setSearchQuery("");

    const nextIncompleteTarget = findFirstIncompleteTarget(
      nextRoute.pickup,
      nextRoute.stops,
    );

    if (flowMode === "booking") {
      if (nextIncompleteTarget !== null) {
        // Keep the user on the search page until the next required field is filled.
        // Once From + To are filled, do NOT auto-close the page; the rider may still
        // want to add a stop before returning to the main screen.
        setMode("form");
        focusInlineField(nextIncompleteTarget);
        return;
      }

      setMode("form");
      setActiveInline(null);
      return;
    }

    setActiveInline(null);
  };

  const handlePlaceSelection = (place: PlaceSuggestion) => {
    void saveRecentPlaceSearch(place)
      .then((next) => setRecentPlaces(next))
      .catch(() => {});

    handleSuggestionPress(formatSuggestionValue(place));
  };

  const handleLauncherPlaceSelection = (place: PlaceSuggestion) => {
    const value = formatSuggestionValue(place);

    void saveRecentPlaceSearch(place)
      .then((next) => setRecentPlaces(next))
      .catch(() => {});

    setRouteStops((current) =>
      current.map((stop, index) =>
        index === current.length - 1 ? value : stop,
      ),
    );

    if (!pickupValue.trim()) {
      openEditor("pickup");
    }
  };

  const handleSearchSubmit = () => {
    const value = searchQuery.trim();
    if (!value) return;
    handleSuggestionPress(value);
  };

  const handleAddStop = () => {
    if (intermediateStops.length >= MAX_ADDITIONAL_STOPS) return;

    const insertIndex = routeStops.length - 1;
    setRouteStops((current) => {
      const next = [...current];
      next.splice(insertIndex, 0, "");
      return next;
    });

    openEditor(insertIndex);
  };

  const handleRemoveStop = (index: number) => {
    if (intermediateStops.length === 0) return;

    setActiveInline((current) => {
      if (typeof current !== "number") return current;
      if (current === index) {
        setSearchQuery("");
        return null;
      }
      return current > index ? current - 1 : current;
    });

    setRouteStops((current) => current.filter((_, i) => i !== index));
  };

  const getActiveSearchPlaceholder = () => {
    if (activeInline === "pickup") return "Search pickup";

    if (typeof activeInline === "number") {
      return activeInline === destinationIndex
        ? "Search destination"
        : `Search stop ${activeInline + 1}`;
    }

    return "Tap From, Stop, or To";
  };

  const handleReferralCodeChange = (value: string) => {
    setReferralCode(value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
    setReferralMessage(null);
  };

  const handleApplyReferralCode = async () => {
    const code = referralCode.trim();
    if (!code || referralApplied || isApplyingReferral) {
      return;
    }

    if (!isBackendConfigured() || !isReady || !user) {
      setReferralMessage("Sign in first to apply a referral code.");
      return;
    }

    setIsApplyingReferral(true);
    setReferralMessage(null);

    try {
      const accessToken = await getAccessTokenWithRetry(getAccessToken);
      if (!accessToken) {
        throw new Error("Sign in again to apply this code.");
      }

      const result = await applyReferralCode({ accessToken, code });
      setReferralApplied(true);
      setReferralMessage(
        result.unlockedCashback
          ? `Code applied. NGN ${Math.round(result.unlockedCashback.amountNgn).toLocaleString("en-NG")} cashback unlocked.`
          : "Code applied. Your referral is now linked.",
      );
    } catch (error) {
      setReferralMessage(
        error instanceof Error
          ? error.message
          : "Could not apply this referral code.",
      );
    } finally {
      setIsApplyingReferral(false);
    }
  };

  // Eager prefetch: resolve geocodes + call getRideEstimate as soon as pickup & destination are set
  useEffect(() => {
    const pickup = pickupValue.trim();
    const destination = destinationValue.trim();
    if (!pickup || !destination || !isBackendConfigured()) return;

    const requestId = ++estimateRequestRef.current;
    let cancelled = false;

    void (async () => {
      try {
        const accessToken = await getAccessTokenWithRetry(getAccessToken);
        if (!accessToken || cancelled) return;

        const [resolvedPickup, resolvedDest, ...resolvedStops] = await Promise.all([
          resolvePlaceQuery(pickup),
          resolvePlaceQuery(destination),
          ...intermediateStops
            .filter((s) => s.trim().length > 0)
            .map((s) => resolvePlaceQuery(s)),
        ]);

        if (cancelled || estimateRequestRef.current !== requestId) return;

        const response = await getRideEstimate({
          accessToken,
          pickup: resolvedPickup,
          destination: resolvedDest,
          stops: resolvedStops,
        });

        if (!cancelled && estimateRequestRef.current === requestId) {
          setPrefetchedEstimate(response);
        }
      } catch {
        // Non-blocking — ride-selection will fetch its own estimate
      }
    })();

    return () => { cancelled = true; };
  // Debounce: only re-trigger when the user settles on both fields
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupValue, destinationValue, intermediateStops.length]);

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
  const maxStopsReached = intermediateStops.length >= MAX_ADDITIONAL_STOPS;
  const hasExtraStops = intermediateStops.length > 0;
  const filledStopsCount = intermediateStops.filter(
    (stop) => stop.trim().length > 0,
  ).length;
  const hasRouteDraft =
    pickupValue.trim().length > 0 ||
    destinationValue.trim().length > 0 ||
    filledStopsCount > 0;

  const launcherTitle = destinationValue.trim() || "Where are you going?";
  const launcherSubtitle = !hasRouteDraft
    ? "Set pickup, destination, and extra stops"
    : pickupValue.trim()
    ? `From ${pickupValue.trim()}`
    : "Tap to add pickup location";

  // Show results panel in form mode whenever a route field is focused.
  const showInlineResults = activeInline != null;
  const isCondensedForm = showInlineResults || hasExtraStops;
  const isUltraCondensedForm = showInlineResults || intermediateStops.length > 1;
  const shouldShowIdleHistory = !showInlineResults && recentPlacesPreview.length > 0;
  const handleFinishEditingRoute = () => {
    const missingTarget = findFirstIncompleteTarget();

    if (missingTarget !== null) {
      openEditor(missingTarget);
      return;
    }

    Keyboard.dismiss();
    setMode("launcher");
    setActiveInline(null);
    setSearchQuery("");
  };

  const handleConfirmRoute = async () => {
    const missingTarget = findFirstIncompleteTarget();

    if (missingTarget !== null) {
      openEditor(missingTarget);
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

  return (
    <AppScreen
      backgroundColor={theme.colors.offWhite}
      scroll={false}
      contentStyle={styles.container}
    >
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />

      <View style={styles.content}>
        {mode === "launcher" ? (
          <View style={styles.modeLayout}>
            <View style={styles.formTopBar}>
              <BackArrow onPress={handleBack} />
              <View style={styles.formTopCopy}>
                <AppText variant="monoSmall" color={theme.colors.muted}>
                  SEARCH RIDE
                </AppText>
                <AppText variant="bodySmall" color={theme.colors.muted}>
                  Where are you going today?
                </AppText>
              </View>
            </View>

            <ScrollView
              bounces={false}
              contentContainerStyle={styles.formScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.launcherRouteBlock}>
                <MainRouteLauncherCard
                  hasRouteDraft={hasRouteDraft}
                  onPress={() => openEditor(getLauncherTarget())}
                  pickupValue={pickupValue}
                  stopsCount={filledStopsCount}
                  subtitle={launcherSubtitle}
                  title={launcherTitle}
                />

                {hasRouteDraft ? (
                  <Pressable
                    disabled={!canAddStop}
                    onPress={handleAddStop}
                    style={[
                      styles.launcherAddStopButton,
                      !canAddStop ? styles.launcherAddStopButtonDisabled : null,
                    ]}
                  >
                    <View style={styles.launcherAddStopIcon}>
                      <MaterialIcons color={theme.colors.black} name="add" size={17} />
                    </View>
                    <AppText variant="bodyMedium">
                      {maxStopsReached ? "Maximum stops reached" : "Add stop"}
                    </AppText>
                  </Pressable>
                ) : null}
              </View>

              <ReferralCodeCard
                applied={referralApplied}
                code={referralCode}
                isApplying={isApplyingReferral}
                message={referralMessage}
                onApply={handleApplyReferralCode}
                onChangeCode={handleReferralCodeChange}
              />

              {recentPlacesPreview.length > 0 ? (
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
                        key={`${item.id}-${index}-launcher-recent`}
                        onPress={() => handleLauncherPlaceSelection(item)}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.footerActionBar}>
              <AppButton
                disabled={isSubmittingRoute}
                title={
                  flowMode === "trip-edit"
                    ? isSubmittingRoute
                      ? "Updating route..."
                      : "Update trip route"
                    : isConfirmDisabled
                    ? "Continue"
                    : "Confirm route"
                }
                onPress={handleConfirmRoute}
              />
            </View>
          </View>
        ) : (
          <View style={styles.modeLayout}>
            <View style={styles.searchHeader}>
              <BackArrow onPress={handleBack} />
              <View style={styles.searchBar}>
                <MaterialIcons
                  color={theme.colors.muted}
                  name="search"
                  size={18}
                />
                <TextInput
                  autoCorrect={false}
                  editable={activeInline !== null}
                  onChangeText={handleSearchQueryChange}
                  onSubmitEditing={handleSearchSubmit}
                  placeholder={getActiveSearchPlaceholder()}
                  placeholderTextColor="#A59B92"
                  ref={searchInputRef}
                  returnKeyType="search"
                  style={styles.searchInput}
                  value={searchQuery}
                />
                {searchQuery.length > 0 ? (
                  <Pressable
                    onPress={handleClearActiveSearch}
                    style={styles.inlineClearButton}
                  >
                    <MaterialIcons color={theme.colors.black} name="close" size={15} />
                  </Pressable>
                ) : null}
              </View>
            </View>

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

                <RouteSummaryRow
                  active={activeInline === "pickup"}
                  color={theme.colors.green}
                  compact={isUltraCondensedForm}
                  dense={isCondensedForm}
                  label="From"
                  marker="circle"
                  onClear={() => clearRouteField("pickup")}
                  onPress={() => focusInlineField("pickup")}
                  placeholder="Where from?"
                  value={pickupValue}
                />

                {hasExtraStops
                  ? intermediateStops.map((stop, index) => (
                      <RouteSummaryRow
                        active={activeInline === index}
                        color={theme.colors.orangeLight}
                        compact={isUltraCondensedForm}
                        dense={isCondensedForm}
                        key={`route-stop-${index}`}
                        label={`Stop ${index + 1}`}
                        marker="square"
                        onPress={() => focusInlineField(index)}
                        onRemove={() => handleRemoveStop(index)}
                        placeholder="Add a stop"
                        value={stop}
                      />
                    ))
                  : null}

                <RouteSummaryRow
                  active={activeInline === destinationIndex}
                  color={theme.colors.orange}
                  compact={isUltraCondensedForm}
                  dense={isCondensedForm}
                  label="To"
                  marker="square"
                  onClear={() => clearRouteField(destinationIndex)}
                  onPress={() => focusInlineField(destinationIndex)}
                  placeholder="Where to?"
                  value={destinationValue}
                />

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

            <View style={styles.footerActionBar}>
              <AppButton
                disabled={flowMode === "trip-edit" ? isSubmittingRoute : isConfirmDisabled}
                title={
                  flowMode === "trip-edit"
                    ? isSubmittingRoute
                      ? "Updating route..."
                      : "Update trip route"
                    : "Done"
                }
                onPress={flowMode === "trip-edit" ? handleConfirmRoute : handleFinishEditingRoute}
              />
            </View>
          </View>
        )}
      </View>
    </AppScreen>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function MainRouteLauncherCard({
  hasRouteDraft,
  onPress,
  pickupValue,
  stopsCount,
  subtitle,
  title,
}: {
  hasRouteDraft: boolean;
  onPress: () => void;
  pickupValue: string;
  stopsCount: number;
  subtitle: string;
  title: string;
}) {
  return (
    <Pressable onPress={onPress} style={styles.launcherRouteCard}>
      <View style={styles.launcherRouteIcon}>
        <MaterialIcons
          color={theme.colors.black}
          name={hasRouteDraft ? "route" : "search"}
          size={20}
        />
      </View>
      <View style={styles.launcherRouteBody}>
        <AppText
          numberOfLines={1}
          variant="bodyMedium"
          color={hasRouteDraft ? theme.colors.black : theme.colors.muted}
        >
          {title}
        </AppText>
        <AppText numberOfLines={1} variant="bodySmall" color={theme.colors.muted}>
          {subtitle}
        </AppText>
        {hasRouteDraft ? (
          <View style={styles.launcherRouteBadgeRow}>
            {pickupValue.trim() ? (
              <View style={styles.launcherRouteBadge}>
                <AppText variant="monoSmall">Pickup set</AppText>
              </View>
            ) : null}
            {stopsCount > 0 ? (
              <View style={styles.launcherRouteBadge}>
                <AppText variant="monoSmall">
                  {stopsCount} {stopsCount === 1 ? "stop" : "stops"}
                </AppText>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      <MaterialIcons color={theme.colors.muted} name="chevron-right" size={22} />
    </Pressable>
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

function ReferralCodeCard({
  applied,
  code,
  isApplying,
  message,
  onApply,
  onChangeCode,
}: {
  applied: boolean;
  code: string;
  isApplying: boolean;
  message: string | null;
  onApply: () => void;
  onChangeCode: (value: string) => void;
}) {
  const canApply = code.trim().length > 0 && !applied && !isApplying;

  return (
    <View style={styles.referralCard}>
      <View style={styles.referralHeader}>
        <View style={styles.referralIcon}>
          <MaterialIcons
            color={theme.colors.black}
            name="card-giftcard"
            size={18}
          />
        </View>
        <View style={styles.referralCopy}>
          <AppText variant="bodyMedium">Referral code</AppText>
          <AppText variant="bodySmall" color={theme.colors.muted}>
            Optional. Add a friend's code once after onboarding.
          </AppText>
        </View>
      </View>

      <View style={styles.referralInputRow}>
        <TextInput
          autoCapitalize="characters"
          editable={!applied && !isApplying}
          onChangeText={onChangeCode}
          placeholder="WHLXXXXXX"
          placeholderTextColor="#A59B92"
          style={styles.referralInput}
          value={code}
        />
        {code.length > 0 && !applied ? (
          <Pressable
            onPress={() => onChangeCode("")}
            style={styles.inlineClearButton}
          >
            <MaterialIcons color={theme.colors.black} name="close" size={15} />
          </Pressable>
        ) : null}
        <Pressable
          disabled={!canApply}
          onPress={onApply}
          style={[
            styles.referralApplyButton,
            !canApply ? styles.referralApplyButtonDisabled : null,
          ]}
        >
          <AppText variant="label" color={theme.colors.offWhite}>
            {applied ? "Applied" : isApplying ? "Applying" : "Apply"}
          </AppText>
        </Pressable>
      </View>

      {message ? (
        <AppText
          variant="bodySmall"
          color={applied ? theme.colors.green : theme.colors.danger}
        >
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

type RouteSummaryRowProps = {
  active: boolean;
  color: string;
  compact?: boolean;
  dense?: boolean;
  label: string;
  marker: "circle" | "square";
  onClear?: () => void;
  onPress: () => void;
  onRemove?: () => void;
  placeholder: string;
  value: string;
};

function RouteSummaryRow({
  active,
  color,
  compact,
  dense,
  label,
  marker,
  onClear,
  onPress,
  onRemove,
  placeholder,
  value,
}: RouteSummaryRowProps) {
  const hasValue = value.trim().length > 0;
  const trailingAction = onRemove ?? (hasValue ? onClear : undefined);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.triggerField,
        dense ? styles.triggerFieldDense : null,
        compact ? styles.triggerFieldCompact : null,
        active ? styles.routeInputActive : null,
      ]}
    >
      <View
        style={[
          marker === "circle" ? styles.markerCircle : styles.markerSquare,
          { backgroundColor: color },
        ]}
      />
      <View style={styles.routeSummaryCopy}>
        <AppText variant="bodySmall" color={theme.colors.muted}>
          {label}
        </AppText>
        <AppText
          numberOfLines={1}
          variant="bodyMedium"
          color={hasValue ? theme.colors.black : theme.colors.muted}
        >
          {hasValue ? value : placeholder}
        </AppText>
      </View>
      {trailingAction ? (
        <Pressable onPress={trailingAction} style={styles.inlineClearButton}>
          <MaterialIcons color={theme.colors.black} name="close" size={15} />
        </Pressable>
      ) : null}
    </Pressable>
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
  footerActionBar: {
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.xl,
    backgroundColor: theme.colors.offWhite,
  },
  launcherRouteBlock: {
    gap: theme.spacing.sm,
  },
  launcherAddStopButton: {
    alignSelf: "flex-start",
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.pill,
    backgroundColor: "#FFF4EA",
    ...theme.shadows.subtle,
  },
  launcherAddStopButtonDisabled: {
    opacity: 0.55,
  },
  launcherAddStopIcon: {
    width: 24,
    height: 24,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.white,
  },
  launcherRouteCard: {
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
  launcherRouteIcon: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    backgroundColor: "#FFF4EA",
    alignItems: "center",
    justifyContent: "center",
  },
  launcherRouteBody: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  launcherRouteBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
    paddingTop: 4,
  },
  launcherRouteBadge: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 3,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.offWhite,
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
  routeSummaryCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
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
  routeInputActive: {
    borderColor: theme.colors.orange,
    backgroundColor: "#FFF8F2",
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
  referralCard: {
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.md,
    backgroundColor: "#FFF4EA",
    ...theme.shadows.card,
  },
  referralHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  referralIcon: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  referralCopy: {
    flex: 1,
    gap: 2,
  },
  referralInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  referralInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.sm,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    color: theme.colors.black,
  },
  referralApplyButton: {
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.orange,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.subtle,
  },
  referralApplyButtonDisabled: {
    opacity: 0.45,
  },
});
