import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

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
import { theme } from "@/theme";

const currentPickup = "Current location • Lekki Phase 1";

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

type ActiveField = "from" | "to";
type ScreenMode = "form" | "search";

export default function DestinationSearchScreen() {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const [mode, setMode] = useState<ScreenMode>("form");
  const [activeField, setActiveField] = useState<ActiveField>("to");
  const [fromValue, setFromValue] = useState(currentPickup);
  const [toValue, setToValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [providerSuggestions, setProviderSuggestions] = useState<
    PlaceSuggestion[]
  >([]);
  const [isSearching, setIsSearching] = useState(false);

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
    setSearchQuery(field === "from" ? fromValue : toValue);
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
    if (activeField === "from") {
      setFromValue(value);
      setMode("form");
      setSearchQuery("");
      return;
    }

    setToValue(value);
    setMode("form");
    setSearchQuery("");
  };

  const otherFieldLabel = activeField === "from" ? "To" : "From";
  const otherFieldValue = activeField === "from" ? toValue : fromValue;

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
                  Choose pickup and destination
                </AppText>
              </View>
            </View>

            <View style={styles.formSheet}>
              <View style={styles.formConnector} />
              <SearchTriggerField
                color={theme.colors.green}
                label="From"
                marker="circle"
                onPress={() => openSearch("from")}
                value={fromValue}
              />
              <SearchTriggerField
                color={theme.colors.orange}
                label="To"
                marker="square"
                onPress={() => openSearch("to")}
                placeholder="Where are you going?"
                value={toValue}
              />
            </View>

            <View style={styles.helperBlock}>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                Tap either field to search places and fill it in.
              </AppText>
            </View>

            <AppButton
              disabled={!fromValue.trim() || !toValue.trim()}
              title="Confirm destination"
              onPress={() => router.push("/ride-selection")}
            />
          </>
        ) : (
          <>
            {activeField === "to" ? (
              <>
                <View style={styles.formTopBar}>
                  <BackArrow onPress={handleBack} />
                  <View style={styles.formTopCopy}>
                    <AppText variant="monoSmall" color={theme.colors.muted}>
                      SEARCH TO
                    </AppText>
                    <AppText variant="bodySmall" color={theme.colors.muted}>
                      Choose your destination
                    </AppText>
                  </View>
                </View>

                <View style={styles.formSheet}>
                  <View style={styles.formConnector} />
                  <SearchTriggerField
                    color={theme.colors.green}
                    label="From"
                    marker="circle"
                    onPress={() => openSearch("from")}
                    value={fromValue}
                  />
                  <View style={styles.triggerFieldBlock}>
                    <AppText variant="bodySmall" color={theme.colors.muted}>
                      To
                    </AppText>
                    <View
                      style={[styles.triggerField, styles.activeInputField]}
                    >
                      <View
                        style={[
                          styles.markerSquare,
                          { backgroundColor: theme.colors.orange },
                        ]}
                      />
                      <MaterialIcons
                        color={theme.colors.muted}
                        name="search"
                        size={18}
                      />
                      <TextInput
                        autoFocus
                        onChangeText={setSearchQuery}
                        placeholder="Where are you going?"
                        placeholderTextColor="#A59B92"
                        ref={inputRef}
                        style={styles.searchFieldInput}
                        value={searchQuery}
                      />
                    </View>
                  </View>
                </View>
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
                      placeholder="Search pickup"
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
                        styles.markerCircle,
                        { backgroundColor: theme.colors.green },
                      ]}
                    />
                  </View>
                  <View style={styles.summaryCopy}>
                    <AppText variant="bodySmall" color={theme.colors.muted}>
                      Editing pickup
                    </AppText>
                    <AppText variant="bodyMedium">
                      {searchQuery || fromValue}
                    </AppText>
                  </View>
                </View>

                <Pressable
                  style={styles.secondarySummary}
                  onPress={() => openSearch("to")}
                >
                  <View style={styles.summaryMarkerWrap}>
                    <View
                      style={[
                        styles.markerSquare,
                        { backgroundColor: theme.colors.orange },
                      ]}
                    />
                  </View>
                  <View style={styles.summaryCopy}>
                    <AppText variant="bodySmall" color={theme.colors.muted}>
                      To
                    </AppText>
                    <AppText variant="bodyMedium">{toValue}</AppText>
                  </View>
                  <AppText variant="monoSmall" color={theme.colors.orange}>
                    Edit
                  </AppText>
                </Pressable>
              </>
            )}

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
                    onPress={() => handleSuggestionPress(item.title)}
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
  placeholder?: string;
  value: string;
};

function SearchTriggerField({
  color,
  label,
  marker,
  onPress,
  placeholder,
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
        <AppText
          variant="body"
          color={value ? theme.colors.black : "#A59B92"}
          style={styles.triggerText}
        >
          {value || placeholder}
        </AppText>
      </Pressable>
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
    height: 40,
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
  activeInputField: {
    borderColor: theme.colors.orange,
    backgroundColor: "#FFF8F2",
  },
  searchFieldInput: {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    color: theme.colors.black,
  },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  searchBar: {
    flex: 1,
    minHeight: 52,
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
  },
  activeSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1.5,
    borderBottomColor: theme.colors.borderLight,
  },
  secondarySummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1.5,
    borderBottomColor: theme.colors.borderLight,
  },
  summaryMarkerWrap: {
    width: 36,
    alignItems: "center",
  },
  summaryCopy: {
    flex: 1,
    gap: 2,
  },
  resultsSection: {
    gap: theme.spacing.xs,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  resultIcon: {
    width: 36,
    height: 36,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.orangeLight,
    alignItems: "center",
    justifyContent: "center",
  },
  resultCopy: {
    flex: 1,
    gap: 2,
  },
  emptyState: {
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.md,
  },
});
