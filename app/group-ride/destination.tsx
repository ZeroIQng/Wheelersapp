import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
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
import type { GroupRideGenderPreference } from "@/lib/api";
import {
  fetchGooglePlaceSuggestions,
  isGoogleMapsConfigured,
  type PlaceSuggestion,
} from "@/lib/google-places";
import {
  readRecentPlaceSearches,
  saveRecentPlaceSearch,
} from "@/lib/place-search-history";
import { useAppLocation } from "@/lib/location";
import { theme } from "@/theme";

type ScreenMode = "form" | "search";
type ActiveField = "pickup" | "destination";

const SEARCH_DEBOUNCE_MS = 280;
const FORM_HISTORY_PREVIEW_LIMIT = 4;

function normalizeGenderPreference(
  value: string | string[] | undefined,
): GroupRideGenderPreference {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "women_only" || raw === "men_only" || raw === "any") {
    return raw;
  }

  return "any";
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
  if (!normalizedQuery) return true;
  return [place.title, place.subtitle, place.address, formatSuggestionValue(place)].some(
    (part) => normalizeSearchText(part).includes(normalizedQuery),
  );
}

function isExactSearchMatch(place: PlaceSuggestion, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return false;
  return [place.title, place.address, formatSuggestionValue(place)].some(
    (part) => normalizeSearchText(part) === normalizedQuery,
  );
}

export default function GroupRideDestinationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ genderPreference?: string }>();
  const inputRef = useRef<TextInput>(null);
  const { currentLocation } = useAppLocation();

  const [mode, setMode] = useState<ScreenMode>("form");
  const [activeField, setActiveField] = useState<ActiveField>("pickup");
  const [pickupValue, setPickupValue] = useState("");
  const [destinationValue, setDestinationValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [providerSuggestions, setProviderSuggestions] = useState<PlaceSuggestion[]>([]);
  const [recentPlaces, setRecentPlaces] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDestinationEditing, setIsDestinationEditing] = useState(false);
  const genderPreference = normalizeGenderPreference(params.genderPreference);

  useEffect(() => {
    if (!currentLocation?.address || pickupValue.trim().length > 0) {
      return;
    }

    setPickupValue(currentLocation.address);
  }, [currentLocation?.address, pickupValue]);

  useEffect(() => {
    if (mode !== "search") return;
    const timeout = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timeout);
  }, [activeField, mode]);

  useEffect(() => {
    let cancelled = false;
    void readRecentPlaceSearches().then((places) => {
      if (!cancelled) setRecentPlaces(places);
    });
    return () => { cancelled = true; };
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

  const hasExactRecentMatch = useMemo(
    () => recentPlaces.some((place) => isExactSearchMatch(place, debouncedSearchQuery)),
    [debouncedSearchQuery, recentPlaces],
  );

  const shouldReuseCurrentRecentMatch = useMemo(
    () => recentPlaces.some((place) => isExactSearchMatch(place, searchQuery)),
    [recentPlaces, searchQuery],
  );

  const recentPlacesPreview = useMemo(
    () => recentPlaces.slice(0, FORM_HISTORY_PREVIEW_LIMIT),
    [recentPlaces],
  );

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
        if (!cancelled) setProviderSuggestions(suggestions);
      } catch {
        if (!cancelled) setProviderSuggestions([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    })();

    return () => { cancelled = true; };
  }, [debouncedSearchQuery, hasExactRecentMatch]);

  const shouldUseProviderResults =
    isGoogleMapsConfigured() && trimmedSearchQuery.length > 0 && !shouldReuseCurrentRecentMatch;

  const uniqueProviderSuggestions = useMemo(() => {
    const filtered = shouldUseProviderResults ? providerSuggestions : [];
    const seen = new Set<string>();
    return filtered.filter((item) => {
      const key = `${item.id}:${item.title}:${item.subtitle}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [providerSuggestions, shouldUseProviderResults]);

  const providerResults = useMemo(
    () =>
      uniqueProviderSuggestions.filter(
        (item) => !matchingRecentPlaces.some((r) => isSamePlaceSuggestion(r, item)),
      ),
    [matchingRecentPlaces, uniqueProviderSuggestions],
  );

  const openSearch = (field: ActiveField) => {
    setActiveField(field);
    setIsDestinationEditing(false);
    const currentVal = field === "pickup" ? pickupValue : destinationValue;
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

  const handlePlaceSelection = (place: PlaceSuggestion) => {
    void saveRecentPlaceSearch(place)
      .then((next) => setRecentPlaces(next))
      .catch(() => {});
    const value = formatSuggestionValue(place);
    Keyboard.dismiss();

    if (mode === "search") {
      if (activeField === "pickup") {
        setPickupValue(value);
      } else {
        setDestinationValue(value);
      }
      setMode("form");
      setSearchQuery("");
      return;
    }

    if (isDestinationEditing) {
      setDestinationValue(value);
      setIsDestinationEditing(false);
      setSearchQuery("");
    }
  };

  const handleDestinationChange = (value: string) => {
    setDestinationValue(value);
    setSearchQuery(value);
  };

  const isConfirmDisabled = !pickupValue.trim() || !destinationValue.trim();

  const showInlineResults = isDestinationEditing;
  const shouldShowIdleHistory = !showInlineResults && recentPlacesPreview.length > 0;

  const handleConfirm = () => {
    router.push({
      pathname: "/group-ride/matching",
      params: { pickup: pickupValue, destination: destinationValue, genderPreference },
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
        {mode === "form" ? (
          <View style={styles.modeLayout}>
            {/* Top bar */}
            <View style={styles.formTopBar}>
              <BackArrow onPress={handleBack} />
              <View style={styles.formTopCopy}>
                <AppText variant="monoSmall" color={theme.colors.muted}>
                  GROUP RIDE
                </AppText>
                <AppText variant="bodySmall" color={theme.colors.muted}>
                  Set your pickup and destination
                </AppText>
              </View>
              <View style={styles.ridersChip}>
                <MaterialIcons name="group" size={14} color={theme.colors.orange} />
                <AppText variant="monoSmall" color={theme.colors.orange}>SHARED</AppText>
              </View>
            </View>

            <ScrollView
              bounces={false}
              contentContainerStyle={styles.formScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Form card */}
              <View style={styles.formSheet}>
                <View style={styles.formConnector} />

                {/* Pickup — taps into full search mode */}
                <SearchTriggerField
                  color={theme.colors.green}
                  label="Pickup"
                  marker="circle"
                  onPress={() => openSearch("pickup")}
                  value={pickupValue}
                />

                {/* Destination — inline editable */}
                <View style={styles.triggerFieldBlock}>
                  <AppText variant="bodySmall" color={theme.colors.muted}>
                    Destination
                  </AppText>
                  <View
                    style={[
                      styles.triggerField,
                      isDestinationEditing ? styles.routeInputActive : null,
                    ]}
                  >
                    <View style={[styles.markerSquare, { backgroundColor: theme.colors.orange }]} />
                    <TextInput
                      onChangeText={handleDestinationChange}
                      onFocus={() => {
                        setIsDestinationEditing(true);
                        setSearchQuery(destinationValue);
                      }}
                      onSubmitEditing={() => setIsDestinationEditing(false)}
                      placeholder="Where are you going?"
                      placeholderTextColor="#A59B92"
                      style={styles.destinationInput}
                      value={destinationValue}
                    />
                  </View>
                </View>
              </View>

              {/* Idle history */}
              {shouldShowIdleHistory ? (
                <View style={styles.historySection}>
                  <View style={styles.sectionHeading}>
                    <AppText variant="monoSmall" color={theme.colors.muted}>HISTORY</AppText>
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

              {/* Inline search results */}
              {showInlineResults ? (
                <View style={styles.resultsSection}>
                  {isSearching ? (
                    <View style={styles.emptyState}>
                      <AppText variant="bodyMedium">Searching places...</AppText>
                      <AppText variant="bodySmall" color={theme.colors.muted}>
                        Finding matching locations.
                      </AppText>
                    </View>
                  ) : matchingRecentPlaces.length > 0 || providerResults.length > 0 ? (
                    <View style={styles.resultsListContent}>
                      {trimmedSearchQuery.length === 0 && matchingRecentPlaces.length > 0 ? (
                        <View style={styles.sectionHeading}>
                          <AppText variant="monoSmall" color={theme.colors.muted}>HISTORY</AppText>
                          <AppText variant="bodySmall" color={theme.colors.muted}>
                            Recent places saved on this device
                          </AppText>
                        </View>
                      ) : null}
                      {matchingRecentPlaces.map((item, index) => (
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
                disabled={isConfirmDisabled}
                title="Find Group Ride"
                onPress={handleConfirm}
              />
            </View>
          </View>
        ) : (
          /* Full search mode */
          <View style={styles.modeLayout}>
            <View style={styles.searchHeader}>
              <BackArrow onPress={handleBack} />
              <View style={styles.searchBar}>
                <MaterialIcons color={theme.colors.muted} name="search" size={18} />
                <TextInput
                  autoFocus
                  onChangeText={setSearchQuery}
                  placeholder={activeField === "pickup" ? "Search pickup" : "Search destination"}
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
                    activeField === "pickup" ? styles.markerCircle : styles.markerSquare,
                    {
                      backgroundColor:
                        activeField === "pickup" ? theme.colors.green : theme.colors.orange,
                    },
                  ]}
                />
              </View>
              <View style={styles.summaryCopy}>
                <AppText variant="bodySmall" color={theme.colors.muted}>
                  {activeField === "pickup" ? "Editing pickup" : "Editing destination"}
                </AppText>
                <AppText variant="bodyMedium">
                  {searchQuery || (activeField === "pickup" ? pickupValue : destinationValue) || "Search for a place"}
                </AppText>
              </View>
            </View>

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
                ) : matchingRecentPlaces.length > 0 || providerResults.length > 0 ? (
                  <View style={styles.resultsListContent}>
                    {trimmedSearchQuery.length === 0 && matchingRecentPlaces.length > 0 ? (
                      <View style={styles.sectionHeading}>
                        <AppText variant="monoSmall" color={theme.colors.muted}>HISTORY</AppText>
                        <AppText variant="bodySmall" color={theme.colors.muted}>
                          Recent places saved on this device
                        </AppText>
                      </View>
                    ) : null}
                    {matchingRecentPlaces.map((item, index) => (
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
                      <AppText variant="monoSmall" color={theme.colors.muted}>HISTORY</AppText>
                      <AppText variant="bodySmall" color={theme.colors.muted}>
                        Recent places saved on this device
                      </AppText>
                    </View>
                    {recentPlaces.length > 0 ? (
                      <View style={styles.resultsListContent}>
                        {recentPlaces.map((item, index) => (
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
  color: string;
  label: string;
  marker: "circle" | "square";
  onPress: () => void;
  value: string;
};

function SearchTriggerField({ color, label, marker, onPress, value }: SearchTriggerFieldProps) {
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
          {value || <AppText variant="body" color="#A59B92">Where are you riding from?</AppText>}
        </AppText>
      </Pressable>
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
        <MaterialIcons color={theme.colors.black} name={icon ?? item.icon} size={18} />
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
  ridersChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 5,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.orange,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.orangeLight,
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
    height: 78,
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
  routeInputActive: {
    borderColor: theme.colors.orange,
    backgroundColor: "#FFF8F2",
  },
  destinationInput: {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    color: theme.colors.black,
    paddingVertical: 0,
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
});
