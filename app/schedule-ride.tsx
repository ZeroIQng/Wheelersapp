import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { LinearGradient } from "expo-linear-gradient";
import { usePrivy } from "@privy-io/expo";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppButton } from "@/components/app-button";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { BackArrow } from "@/components/back-arrow";
import { getAccessTokenWithRetry } from "@/lib/access-token";
import {
  fetchGooglePlaceSuggestions,
  isGoogleMapsConfigured,
  resolvePlaceQuery,
  type PlaceSuggestion,
} from "@/lib/google-places";
import {
  getRideEstimate,
  isBackendConfigured,
  type RideEstimateResponse,
} from "@/lib/api";
import {
  readRecentPlaceSearches,
  saveRecentPlaceSearch,
} from "@/lib/place-search-history";
import {
  buildInstantRideEstimate,
  serializeRideEstimate,
} from "@/lib/ride-estimate";
import {
  MAX_ADDITIONAL_STOPS,
  moveRouteStop,
  serializeRideItinerary,
  type RideItinerary,
} from "@/lib/ride-route";
import { theme } from "@/theme";

// ─── Calendar helpers ─────────────────────────────────────────────────────────

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, "0"),
);
const MERIDIEM_OPTIONS = ["AM", "PM"] as const;

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function getSuggestedTimeForDate(selectedDate: Date) {
  const now = new Date();
  const next = new Date(selectedDate);
  next.setSeconds(0, 0);

  if (selectedDate.toDateString() === now.toDateString()) {
    next.setHours(now.getHours(), now.getMinutes(), 0, 0);
    return next;
  }

  next.setHours(9, 0, 0, 0);
  return next;
}

function getTimeParts(date: Date) {
  const hours24 = date.getHours();
  const meridiem = hours24 >= 12 ? "PM" : "AM";
  const hour = hours24 % 12 || 12;
  const minute = date.getMinutes();
  return { hour, minute, meridiem } as const;
}

function buildScheduledDate(
  selectedDate: Date,
  hour: number,
  minute: number,
  meridiem: (typeof MERIDIEM_OPTIONS)[number],
) {
  const next = new Date(selectedDate);
  const hour24 = meridiem === "PM" ? (hour % 12) + 12 : hour % 12;
  next.setHours(hour24, minute, 0, 0);
  return next;
}

function formatScheduleLabel(date: Date, time: Date | null) {
  if (!time) return null;
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow =
    date.toDateString() ===
    new Date(now.getTime() + 86400000).toDateString();
  const dayLabel = isToday
    ? "Today"
    : isTomorrow
      ? "Tomorrow"
      : date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const timeLabel = time.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${dayLabel} · ${timeLabel}`;
}

function formatSuggestionValue(item: { title: string; subtitle: string }) {
  return item.subtitle ? `${item.title}, ${item.subtitle}` : item.title;
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}

function matchesSearchQuery(place: PlaceSuggestion, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  return [
    place.title,
    place.subtitle,
    place.address,
    formatSuggestionValue(place),
  ].some((part) => normalizeSearchText(part).includes(normalizedQuery));
}

const DRAG_SWAP_THRESHOLD = 88;
const FORM_HISTORY_PREVIEW_LIMIT = 3;
const WHEEL_ITEM_HEIGHT = 44;
const WHEEL_VISIBLE_ROWS = 3;

// ─── Types ────────────────────────────────────────────────────────────────────

type ScreenMode = "form" | "search";
type ActiveField =
  | { type: "pickup" }
  | { type: "stop"; index: number }
  | { type: "destination" };

// ─── WheelColumn ─────────────────────────────────────────────────────────────
// No border, no internal overlay — the parent drumPickerContainer owns all chrome.

function WheelColumn<T extends string | number>({
  options,
  selectedValue,
  onSelect,
  renderLabel,
}: {
  options: readonly T[];
  selectedValue: T;
  onSelect: (value: T) => void;
  renderLabel?: (value: T) => string;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const didInitialScrollRef = useRef(false);
  const sidePadding = WHEEL_ITEM_HEIGHT * Math.floor(WHEEL_VISIBLE_ROWS / 2);

  const commitOffset = (offsetY: number) => {
    const nextIndex = Math.max(
      0,
      Math.min(options.length - 1, Math.round(offsetY / WHEEL_ITEM_HEIGHT)),
    );
    onSelect(options[nextIndex]);
  };

  const syncToSelectedValue = (animated: boolean) => {
    const index = Math.max(0, options.findIndex((o) => o === selectedValue));
    scrollRef.current?.scrollTo({ y: index * WHEEL_ITEM_HEIGHT, animated });
  };

  useEffect(() => {
    if (didInitialScrollRef.current) {
      syncToSelectedValue(false);
    }
  }, [selectedValue]);

  return (
    <View style={styles.wheelColumnWrap}>
      <ScrollView
        ref={scrollRef}
        bounces={false}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_HEIGHT}
        decelerationRate="fast"
        onLayout={() => {
          if (!didInitialScrollRef.current) {
            didInitialScrollRef.current = true;
            syncToSelectedValue(false);
          }
        }}
        contentContainerStyle={{
          paddingTop: sidePadding,
          paddingBottom: sidePadding,
        }}
        onMomentumScrollEnd={(e) => commitOffset(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(e) => commitOffset(e.nativeEvent.contentOffset.y)}
      >
        {options.map((option, index) => {
          const selected = option === selectedValue;
          return (
            <Pressable
              key={`${String(option)}-${index}`}
              onPress={() => onSelect(option)}
              style={styles.wheelItem}
            >
              <AppText
                variant="bodyMedium"
                color={selected ? theme.colors.black : theme.colors.muted}
                style={selected ? styles.wheelItemSelectedText : styles.wheelItemMutedText}
              >
                {renderLabel ? renderLabel(option) : String(option)}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function MeridiemToggle({
  value,
  onChange,
}: {
  value: (typeof MERIDIEM_OPTIONS)[number];
  onChange: (value: (typeof MERIDIEM_OPTIONS)[number]) => void;
}) {
  return (
    <View style={styles.meridiemToggleRow}>
      {MERIDIEM_OPTIONS.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={[
              styles.meridiemToggleButton,
              selected ? styles.meridiemToggleButtonSelected : null,
            ]}
          >
            <AppText
              variant="bodyMedium"
              color={selected ? theme.colors.white : theme.colors.black}
              style={selected ? styles.meridiemToggleTextSelected : null}
            >
              {option}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Schedule modal ───────────────────────────────────────────────────────────

function ScheduleModal({
  visible,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (date: Date, time: Date) => void;
}) {
  const insets = useSafeAreaInsets();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date>(now);
  const [selectedHour, setSelectedHour] = useState<number>(
    () => getTimeParts(getSuggestedTimeForDate(now)).hour,
  );
  const [selectedMinute, setSelectedMinute] = useState<number>(
    () => getTimeParts(getSuggestedTimeForDate(now)).minute,
  );
  const [selectedMeridiem, setSelectedMeridiem] = useState<
    (typeof MERIDIEM_OPTIONS)[number]
  >(() => getTimeParts(getSuggestedTimeForDate(now)).meridiem);

  const calendarDays = useMemo(
    () => getCalendarDays(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const selectedDateTime = useMemo(
    () => buildScheduledDate(selectedDate, selectedHour, selectedMinute, selectedMeridiem),
    [selectedDate, selectedHour, selectedMinute, selectedMeridiem],
  );
  const isSelectedTimeValid = true;

  useEffect(() => {
    const suggested = getSuggestedTimeForDate(selectedDate);
    const parts = getTimeParts(suggested);
    setSelectedHour(parts.hour);
    setSelectedMinute(parts.minute);
    setSelectedMeridiem(parts.meridiem);
  }, [selectedDate]);

  const maxDate = new Date(now);
  maxDate.setDate(now.getDate() + 7);

  const isDateDisabled = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    d.setHours(0, 0, 0, 0);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    return d < today || d > maxDate;
  };

  const isDateSelected = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    return (
      d.getDate() === selectedDate.getDate() &&
      d.getMonth() === selectedDate.getMonth() &&
      d.getFullYear() === selectedDate.getFullYear()
    );
  };

  const isToday = (day: number) => {
    return new Date(viewYear, viewMonth, day).toDateString() === now.toDateString();
  };

  const goToPrevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const handleDayPress = (day: number) => {
    if (isDateDisabled(day)) return;
    setSelectedDate(new Date(viewYear, viewMonth, day));
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View pointerEvents="box-none" style={styles.modalRoot}>
      <Pressable style={styles.modalOverlay} onPress={onClose} />
      <View style={styles.modalSheet}>
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.modalBodyScrollContent}
        >
          <View style={styles.sheetHandleWrap}>
            <View style={styles.sheetHandle} />
          </View>

          <View style={styles.modalHeader}>
            <AppText variant="bodyMedium">Pick date & time</AppText>
            <Pressable onPress={onClose} style={styles.modalCloseBtn}>
              <MaterialIcons name="close" size={18} color={theme.colors.black} />
            </Pressable>
          </View>

          {/* ── Calendar ── */}
          <View style={styles.calendarWrap}>
            <View style={styles.monthNav}>
              <Pressable onPress={goToPrevMonth} style={styles.monthNavBtn}>
                <MaterialIcons name="chevron-left" size={22} color={theme.colors.black} />
              </Pressable>
              <AppText variant="bodyMedium">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </AppText>
              <Pressable onPress={goToNextMonth} style={styles.monthNavBtn}>
                <MaterialIcons name="chevron-right" size={22} color={theme.colors.black} />
              </Pressable>
            </View>

            <View style={styles.calendarGrid}>
              {DAY_LABELS.map((d) => (
                <View key={d} style={styles.calCell}>
                  <AppText variant="monoSmall" color={theme.colors.muted} style={styles.calDayLabel}>
                    {d}
                  </AppText>
                </View>
              ))}
              {calendarDays.map((day, idx) => {
                if (day === null) return <View key={`empty-${idx}`} style={styles.calCell} />;
                const disabled = isDateDisabled(day);
                const selected = isDateSelected(day);
                const today = isToday(day);
                return (
                  <Pressable
                    key={`day-${idx}`}
                    onPress={() => handleDayPress(day)}
                    disabled={disabled}
                    style={styles.calCell}
                  >
                    <View
                      style={[
                        styles.calDayInner,
                        selected ? styles.calDaySelected : null,
                        today && !selected ? styles.calDayToday : null,
                      ]}
                    >
                      <AppText
                        variant="bodyMedium"
                        color={disabled ? "#CCC" : selected ? theme.colors.white : theme.colors.black}
                        style={styles.calDayNum}
                      >
                        {day}
                      </AppText>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.modalDivider} />

          {/* ── Time picker ── */}
          <View style={styles.timeSectionWrap}>
            <AppText variant="bodyMedium">Choose your time</AppText>

            <View style={styles.wheelLabelsRow}>
              <AppText variant="monoSmall" color={theme.colors.muted} style={styles.wheelLabel}>
                HOUR
              </AppText>
              <AppText variant="monoSmall" color={theme.colors.muted} style={styles.wheelLabel}>
                MIN
              </AppText>
            </View>

            <View style={styles.drumPickerContainer}>
              <View pointerEvents="none" style={styles.drumHighlightBar} />
              <LinearGradient
                pointerEvents="none"
                colors={["rgba(255,255,255,1)", "rgba(255,255,255,0)"]}
                style={styles.drumFadeTop}
              />
              <LinearGradient
                pointerEvents="none"
                colors={["rgba(255,255,255,0)", "rgba(255,255,255,1)"]}
                style={styles.drumFadeBottom}
              />

              <WheelColumn
                options={HOUR_OPTIONS}
                selectedValue={selectedHour}
                onSelect={setSelectedHour}
              />
              <WheelColumn
                options={MINUTE_OPTIONS}
                selectedValue={String(selectedMinute).padStart(2, "0")}
                onSelect={(value) => setSelectedMinute(Number(value))}
              />
            </View>

            <MeridiemToggle
              value={selectedMeridiem}
              onChange={setSelectedMeridiem}
            />

            <View style={styles.selectedTimeSummary}>
              <AppText variant="bodyMedium">
                {formatScheduleLabel(selectedDate, selectedDateTime)}
              </AppText>
            </View>
          </View>
        </ScrollView>

        <View style={[styles.modalFooter, { paddingBottom: insets.bottom }]}>
          <AppButton
            disabled={false}
            title={`Confirm — ${formatScheduleLabel(selectedDate, selectedDateTime)}`}
            onPress={() => {
              onConfirm(selectedDate, selectedDateTime);
            }}
          />
        </View>
      </View>
      </View>
    </Modal>
  );
}

// ─── Route sub-components ─────────────────────────────────────────────────────

function SearchTriggerField({
  dense,
  compact,
  color,
  label,
  marker,
  onPress,
  value,
}: {
  dense?: boolean;
  compact?: boolean;
  color: string;
  label: string;
  marker: "circle" | "square";
  onPress: () => void;
  value: string;
}) {
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
      <Pressable
        onPress={onPress}
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
        <AppText numberOfLines={1} variant="body" style={styles.triggerText}>
          {value || (
            <AppText variant="body" color={theme.colors.muted}>
              Where from?
            </AppText>
          )}
        </AppText>
        <MaterialIcons name="edit" size={14} color={theme.colors.muted} />
      </Pressable>
    </View>
  );
}

function DestinationField({
  dense,
  compact,
  isEditing,
  onChangeText,
  onFocus,
  onSubmitEditing,
  value,
}: {
  dense?: boolean;
  compact?: boolean;
  isEditing: boolean;
  onChangeText: (value: string) => void;
  onFocus: () => void;
  onSubmitEditing: () => void;
  value: string;
}) {
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
          style={styles.inlineInput}
          value={value}
        />
      </View>
    </View>
  );
}

type StopRouteFieldProps = {
  canRemove: boolean;
  dense?: boolean;
  compact?: boolean;
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
  dense,
  compact,
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
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
        onPanResponderGrant: onReorderStart,
        onPanResponderRelease: (_, g) => { onReorder(g.dy); onReorderEnd(); },
        onPanResponderTerminate: onReorderEnd,
      }),
    [onReorder, onReorderEnd, onReorderStart],
  );

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
      <View style={[styles.stopFieldRow, isDragging ? styles.stopFieldRowDragging : null]}>
        <View
          style={[
            styles.stopFieldPressable,
            dense ? styles.stopFieldPressableDense : null,
            compact ? styles.stopFieldPressableCompact : null,
            isEditing ? styles.routeInputActive : null,
          ]}
        >
          <View style={[styles.markerSquare, { backgroundColor: theme.colors.orangeLight }]} />
          <TextInput
            onChangeText={onChangeText}
            onFocus={onFocus}
            onSubmitEditing={onSubmitEditing}
            placeholder="Add a stop"
            placeholderTextColor="#A59B92"
            style={styles.inlineInput}
            value={value}
          />
          <View {...panResponder.panHandlers} style={[styles.inlineDragButton, styles.dragButton]}>
            <AppText variant="monoSmall" color={theme.colors.black}>
              =
            </AppText>
          </View>
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

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ScheduleRideScreen() {
  const router = useRouter();
  const { getAccessToken, isReady, user } = usePrivy();
  const formScrollRef = useRef<ScrollView>(null);

  const [mode, setMode] = useState<ScreenMode>("form");
  const [activeField, setActiveField] = useState<ActiveField>({ type: "pickup" });
  const [pickupValue, setPickupValue] = useState("");
  const [routeStops, setRouteStops] = useState<string[]>([""]);
  const [activeRouteIndex, setActiveRouteIndex] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [providerSuggestions, setProviderSuggestions] = useState<PlaceSuggestion[]>([]);
  const [recentPlaces, setRecentPlaces] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [calendarVisible, setCalendarVisible] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [scheduledTime, setScheduledTime] = useState<Date | null>(null);
  const [prefetchedEstimate, setPrefetchedEstimate] =
    useState<RideEstimateResponse | null>(null);

  const inputRef = useRef<TextInput>(null);
  const estimateRequestRef = useRef(0);

  const destinationValue = routeStops[routeStops.length - 1] ?? "";
  const intermediateStops = routeStops.slice(0, -1);

  useEffect(() => {
    if (mode !== "search") return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [activeField, mode]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const stored = await readRecentPlaceSearches();
      if (!cancelled) setRecentPlaces(stored);
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isGoogleMapsConfigured()) {
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
        const suggestions = await fetchGooglePlaceSuggestions(normalized);
        if (!cancelled) setProviderSuggestions(suggestions);
      } catch {
        if (!cancelled) setProviderSuggestions([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 220);
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [searchQuery]);

  const uniqueSuggestions = useMemo(() => {
    if (!isGoogleMapsConfigured() || !searchQuery.trim()) return [];
    const seen = new Set<string>();
    return providerSuggestions.filter((item) => {
      const key = `${item.id}:${item.title}:${item.subtitle}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [providerSuggestions, searchQuery]);

  const matchingRecentPlaces = useMemo(
    () => recentPlaces.filter((p) => matchesSearchQuery(p, searchQuery)),
    [recentPlaces, searchQuery],
  );
  const recentPlacesPreview = useMemo(() => recentPlaces.slice(0, FORM_HISTORY_PREVIEW_LIMIT), [recentPlaces]);
  const matchingRecentPlacesPreview = useMemo(
    () => matchingRecentPlaces.slice(0, FORM_HISTORY_PREVIEW_LIMIT),
    [matchingRecentPlaces],
  );
  const providerResults = useMemo(
    () =>
      uniqueSuggestions.filter(
        (item) =>
          !matchingRecentPlacesPreview.some(
            (r) => normalizeSearchText(r.address) === normalizeSearchText(item.address),
          ),
      ),
    [matchingRecentPlacesPreview, uniqueSuggestions],
  );

  const openSearch = (field: ActiveField) => {
    setActiveRouteIndex(null);
    setActiveField(field);
    setSearchQuery("");
    setMode("search");
  };

  const handleBack = () => {
    if (mode === "search") { setMode("form"); setSearchQuery(""); return; }
    router.back();
  };

  const handlePlaceSelection = (place: PlaceSuggestion) => {
    void saveRecentPlaceSearch(place).then((next) => setRecentPlaces(next)).catch(() => {});
    handleSuggestionPress(formatSuggestionValue(place));
  };

  const handleSuggestionPress = (value: string) => {
    Keyboard.dismiss();
    if (mode === "search") {
      if (activeField.type === "pickup") {
        setPickupValue(value);
      } else if (activeField.type === "destination") {
        setRouteStops((cur) => cur.map((s, i) => (i === cur.length - 1 ? value : s)));
      } else {
        const idx = (activeField as { type: "stop"; index: number }).index;
        setRouteStops((cur) => cur.map((s, i) => (i === idx ? value : s)));
      }
      setMode("form");
      setSearchQuery("");
      return;
    }
    if (activeRouteIndex != null) {
      setRouteStops((cur) => cur.map((s, i) => (i === activeRouteIndex ? value : s)));
      setActiveRouteIndex(null);
      setSearchQuery("");
    }
  };

  const handleAddStop = () => {
    if (intermediateStops.length >= MAX_ADDITIONAL_STOPS) return;
    const insertIndex = routeStops.length - 1;
    setRouteStops((cur) => { const next = [...cur]; next.splice(insertIndex, 0, ""); return next; });
    setActiveRouteIndex(insertIndex);
    setSearchQuery("");
    requestAnimationFrame(() => formScrollRef.current?.scrollTo({ y: 0, animated: true }));
  };

  const handleRemoveStop = (index: number) => {
    if (activeRouteIndex === index) { setActiveRouteIndex(null); setSearchQuery(""); }
    setRouteStops((cur) => cur.filter((_, i) => i !== index));
  };

  const handleReorderStop = (index: number, dy: number) => {
    const offset = Math.round(dy / DRAG_SWAP_THRESHOLD);
    if (offset === 0) return;
    setActiveRouteIndex(null);
    setSearchQuery("");
    setRouteStops((cur) => {
      const lastMovable = cur.length - 2;
      const nextIndex = Math.max(0, Math.min(lastMovable, index + offset));
      return moveRouteStop(cur, index, nextIndex);
    });
  };

  const handleDestinationChange = (value: string) => {
    setRouteStops((cur) => cur.map((s, i) => (i === cur.length - 1 ? value : s)));
    setSearchQuery(value);
  };

  const handleStopChange = (index: number, value: string) => {
    setRouteStops((cur) => cur.map((s, i) => (i === index ? value : s)));
    setSearchQuery(value);
  };

  const canAddStop =
    intermediateStops.length < MAX_ADDITIONAL_STOPS &&
    intermediateStops.every((s) => s.trim().length > 0);
  const maxStopsReached = intermediateStops.length >= MAX_ADDITIONAL_STOPS;
  const hasExtraStops = intermediateStops.length > 0;
  const showInlineResults = activeRouteIndex != null;
  const isCondensedForm = showInlineResults || hasExtraStops;
  const isUltraCondensedForm = showInlineResults || intermediateStops.length > 1;
  const firstIncompleteStopIndex = intermediateStops.findIndex((s) => s.trim().length === 0);
  const hasCompleteRoute =
    pickupValue.trim().length > 0 &&
    destinationValue.trim().length > 0 &&
    firstIncompleteStopIndex < 0;

  const focusInlineField = (index: number) => {
    setActiveRouteIndex(index);
    setSearchQuery("");
    requestAnimationFrame(() => formScrollRef.current?.scrollTo({ y: 0, animated: true }));
  };

  const handleConfirmSchedule = () => {
    if (!pickupValue.trim()) { openSearch({ type: "pickup" }); return; }
    if (firstIncompleteStopIndex >= 0) { focusInlineField(firstIncompleteStopIndex); return; }
    if (!destinationValue.trim()) { focusInlineField(routeStops.length - 1); return; }
    if (!scheduledDate || !scheduledTime) { setCalendarVisible(true); return; }
    router.push({
      pathname: "/ride-selection",
      params: {
        itinerary: serializedItinerary,
        estimate: serializeRideEstimate(prefetchedEstimate ?? instantEstimate),
        scheduledAt: scheduledTime.toISOString(),
      },
    });
  };

  const itinerary: RideItinerary = { pickup: pickupValue, stops: routeStops };
  const serializedItinerary = serializeRideItinerary(itinerary);
  const instantEstimate = useMemo(
    () => buildInstantRideEstimate(itinerary),
    [itinerary],
  );
  const scheduleLabel =
    scheduledDate && scheduledTime ? formatScheduleLabel(scheduledDate, scheduledTime) : null;

  useEffect(() => {
    if (!isBackendConfigured() || !isReady || !user || !hasCompleteRoute) {
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
          ...itinerary.stops.slice(0, -1).map((stop) => resolvePlaceQuery(stop)),
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
  }, [getAccessToken, hasCompleteRoute, isReady, itinerary, user]);

  const searchHeading =
    activeField.type === "pickup"
      ? "Search pickup"
      : activeField.type === "destination"
        ? "Search destination"
        : `Search stop ${(activeField as { type: "stop"; index: number }).index + 1}`;

  const activeSummaryLabel =
    activeField.type === "pickup"
      ? "Editing pickup"
      : activeField.type === "destination"
        ? "Editing destination"
        : `Editing stop ${(activeField as { type: "stop"; index: number }).index + 1}`;

  const activeFieldCurrentValue =
    activeField.type === "pickup"
      ? pickupValue
      : activeField.type === "destination"
        ? destinationValue
        : (routeStops[(activeField as { type: "stop"; index: number }).index] ?? "");

  return (
    <AppScreen
      backgroundColor={theme.colors.offWhite}
      scroll={false}
      contentStyle={styles.container}
    >
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />

      <ScheduleModal
        visible={calendarVisible}
        onClose={() => setCalendarVisible(false)}
        onConfirm={(date, time) => {
          setScheduledDate(date);
          setScheduledTime(time);
          setCalendarVisible(false);
        }}
      />

      <View style={styles.content}>
        {mode === "form" ? (
          <View style={styles.modeLayout}>
            {/* Top bar */}
            <View style={styles.formTopBar}>
              <BackArrow onPress={handleBack} />
              <View style={styles.formTopCopy}>
                <AppText variant="monoSmall" color={theme.colors.muted}>
                  SCHEDULE RIDE
                </AppText>
                <AppText variant="bodySmall" color={theme.colors.muted}>
                  Plan your ride ahead and lock in the exact time
                </AppText>
              </View>
              <View style={styles.clockBadge}>
                <MaterialIcons name="schedule" size={18} color={theme.colors.orange} />
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
              {/* Route card */}
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

                <SearchTriggerField
                  dense={isCondensedForm}
                  compact={isUltraCondensedForm}
                  color={theme.colors.green}
                  label="Pickup"
                  marker="circle"
                  onPress={() => openSearch({ type: "pickup" })}
                  value={pickupValue}
                />

                {hasExtraStops
                  ? intermediateStops.map((stop, index) => (
                      <StopRouteField
                        canRemove
                        dense={isCondensedForm}
                        compact={isUltraCondensedForm}
                        isEditing={activeRouteIndex === index}
                        isDragging={draggingIndex === index}
                        key={`stop-${index}`}
                        label={`Stop ${index + 1}`}
                        onChangeText={(v) => handleStopChange(index, v)}
                        onFocus={() => {
                          setActiveRouteIndex(index);
                          setSearchQuery("");
                          requestAnimationFrame(() =>
                            formScrollRef.current?.scrollTo({ y: 0, animated: true }),
                          );
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

                <DestinationField
                  dense={isCondensedForm}
                  compact={isUltraCondensedForm}
                  isEditing={activeRouteIndex === routeStops.length - 1}
                  onChangeText={handleDestinationChange}
                  onFocus={() => {
                    setActiveRouteIndex(routeStops.length - 1);
                    setSearchQuery("");
                    requestAnimationFrame(() =>
                      formScrollRef.current?.scrollTo({ y: 0, animated: true }),
                    );
                  }}
                  onSubmitEditing={() => setActiveRouteIndex(null)}
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
                  <AppText variant="bodyMedium">
                    {maxStopsReached ? "Maximum stops reached" : "Add stop"}
                  </AppText>
                </Pressable>
              </View>

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
                  ) : uniqueSuggestions.length > 0 ? (
                    <View style={styles.resultsListContent}>
                      {uniqueSuggestions.map((item, index) => (
                        <Pressable
                          key={`${item.id}-${index}`}
                          onPress={() => handleSuggestionPress(formatSuggestionValue(item))}
                          style={styles.resultRow}
                        >
                          <View style={styles.resultIcon}>
                            <MaterialIcons color={theme.colors.black} name={item.icon} size={18} />
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

              {!showInlineResults ? (
                <Pressable
                  onPress={() => setCalendarVisible(true)}
                  style={[
                    styles.scheduleTrigger,
                    scheduleLabel ? styles.scheduleTriggerSet : null,
                  ]}
                >
                  <View style={styles.scheduleTriggerIcon}>
                    <MaterialIcons
                      name="calendar-today"
                      size={16}
                      color={scheduleLabel ? theme.colors.white : theme.colors.orange}
                    />
                  </View>
                  <View style={styles.scheduleTriggerCopy}>
                    {scheduleLabel ? (
                      <>
                        <AppText variant="monoSmall" color={theme.colors.white}>
                          SCHEDULED
                        </AppText>
                        <AppText variant="bodyMedium" color={theme.colors.white}>
                          {scheduleLabel}
                        </AppText>
                      </>
                    ) : (
                      <>
                        <AppText variant="bodyMedium">Pick date & time</AppText>
                        <AppText variant="bodySmall" color={theme.colors.muted}>
                          Choose the exact day and time for this ride
                        </AppText>
                      </>
                    )}
                  </View>
                  <MaterialIcons
                    name="chevron-right"
                    size={20}
                    color={scheduleLabel ? theme.colors.white : theme.colors.muted}
                  />
                </Pressable>
              ) : null}
            </ScrollView>

            {/* Footer */}
            <View style={styles.footerActionBar}>
              <AppButton disabled={false} title="Schedule ride" onPress={handleConfirmSchedule} />
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
                    activeField.type === "pickup" ? styles.markerCircle : styles.markerSquare,
                    {
                      backgroundColor:
                        activeField.type === "pickup" ? theme.colors.green : theme.colors.orange,
                    },
                  ]}
                />
              </View>
              <View style={styles.summaryCopy}>
                <AppText variant="bodySmall" color={theme.colors.muted}>
                  {activeSummaryLabel}
                </AppText>
                <AppText variant="bodyMedium">
                  {searchQuery || activeFieldCurrentValue || "Search for a place"}
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
                ) : matchingRecentPlacesPreview.length > 0 || providerResults.length > 0 ? (
                  <View style={styles.resultsListContent}>
                    {searchQuery.trim().length === 0 && matchingRecentPlacesPreview.length > 0 ? (
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
                      <Pressable
                        key={`${item.id}-${index}-history`}
                        onPress={() => handlePlaceSelection(item)}
                        style={styles.resultRow}
                      >
                        <View style={styles.resultIcon}>
                          <MaterialIcons color={theme.colors.black} name="history" size={18} />
                        </View>
                        <View style={styles.resultCopy}>
                          <AppText variant="bodyMedium">{item.title}</AppText>
                          <AppText variant="bodySmall" color={theme.colors.muted}>
                            {item.subtitle}
                          </AppText>
                        </View>
                      </Pressable>
                    ))}
                    {providerResults.map((item, index) => (
                      <Pressable
                        key={`${item.id}-${index}-provider`}
                        onPress={() => handlePlaceSelection(item)}
                        style={styles.resultRow}
                      >
                        <View style={styles.resultIcon}>
                          <MaterialIcons color={theme.colors.black} name={item.icon} size={18} />
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
                          <Pressable
                            key={`${item.id}-${index}-empty-history`}
                            onPress={() => handlePlaceSelection(item)}
                            style={styles.resultRow}
                          >
                            <View style={styles.resultIcon}>
                              <MaterialIcons color={theme.colors.black} name="history" size={18} />
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: theme.spacing.lg, paddingBottom: 0 },
  content: { flex: 1 },
  modeLayout: { flex: 1, gap: theme.spacing.md, overflow: "visible" },

  formTopBar: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  formTopCopy: { flex: 1, gap: 2 },
  clockBadge: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: "#FFF4EA",
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.subtle,
  },

  formScrollContent: { flexGrow: 1, paddingBottom: theme.spacing.xl, gap: theme.spacing.md },
  formScrollContentCondensed: { paddingBottom: theme.spacing.lg, gap: theme.spacing.sm },
  formScrollContentCompact: { paddingBottom: theme.spacing.md, gap: theme.spacing.xs },
  searchScrollContent: { flexGrow: 1, paddingBottom: theme.spacing.xl },

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
  formConnectorCondensed: { left: 23, top: 48 },
  formConnectorDense: { left: 23, top: 50 },

  triggerFieldBlock: { gap: theme.spacing.xs },
  triggerFieldBlockDense: { gap: 4 },
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
  fieldLabelDense: { fontSize: 11, lineHeight: 14 },
  fieldLabelCompact: { fontSize: 10, lineHeight: 12 },
  triggerText: { flex: 1 },
  inlineInput: {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    color: theme.colors.black,
    paddingVertical: 0,
  },
  routeInputActive: { borderColor: theme.colors.orange, backgroundColor: "#FFF8F2" },
  markerCircle: {
    width: 8, height: 8,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
  },
  markerSquare: {
    width: 8, height: 8,
    borderRadius: 2,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
  },

  stopFieldRow: { flexDirection: "row", alignItems: "stretch", gap: theme.spacing.sm },
  stopFieldRowDragging: { opacity: 0.72 },
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
  inlineDragButton: {
    width: 32, minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    borderRadius: 8,
    backgroundColor: theme.colors.white,
    flexShrink: 0,
  },
  dragButton: { backgroundColor: "#FFF4EA" },
  iconButton: {
    width: 44, minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.white,
    ...theme.shadows.subtle,
  },
  iconButtonCompact: { width: 40, minHeight: 46 },
  iconButtonDense: { width: 42, minHeight: 50 },
  iconButtonPlaceholder: { width: 44 },

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
  addStopRowDisabled: { opacity: 0.55 },
  addStopIcon: {
    width: 28, height: 28,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.white,
  },

  resultsSection: { gap: theme.spacing.sm },
  historySection: { gap: theme.spacing.sm },
  sectionHeading: { gap: 2, paddingHorizontal: theme.spacing.xs },
  resultsListContent: { gap: theme.spacing.sm },
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
    width: 34, height: 34,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.orangeLight,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    alignItems: "center",
    justifyContent: "center",
  },
  resultCopy: { flex: 1, gap: 1 },
  emptyState: { paddingVertical: theme.spacing.md, gap: theme.spacing.xs },

  scheduleTrigger: {
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
  scheduleTriggerSet: {
    backgroundColor: theme.colors.black,
    borderColor: theme.colors.black,
  },
  scheduleTriggerIcon: {
    width: 38, height: 38,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.regular,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  scheduleTriggerCopy: { flex: 1, gap: 2 },

  footerActionBar: {
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.xl,
    backgroundColor: theme.colors.offWhite,
  },

  searchHeader: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
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
  summaryMarkerWrap: { width: 22, alignItems: "center" },
  summaryCopy: { flex: 1, gap: 2 },

  // ── Modal shell ──────────────────────────────────────────────────────────────
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalSheet: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: theme.borders.thick,
    borderLeftWidth: theme.borders.thick,
    borderRightWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    maxHeight: "92%",
    flexShrink: 1,
  },
  modalBodyScrollContent: {
    paddingBottom: theme.spacing.sm,
  },
  sheetHandleWrap: { alignItems: "center", paddingTop: 12, paddingBottom: 4 },
  sheetHandle: {
    width: 44, height: 5,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.black,
    opacity: 0.15,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  modalCloseBtn: {
    width: 34, height: 34,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.offWhite,
  },

  // ── Calendar ─────────────────────────────────────────────────────────────────
  calendarWrap: { paddingHorizontal: theme.spacing.md, paddingBottom: 4 },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  monthNavBtn: {
    width: 36, height: 36,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.offWhite,
  },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  calCell: { width: "14.285%", alignItems: "center", paddingVertical: 1 },
  calDayLabel: { fontSize: 10, lineHeight: 14, letterSpacing: 0.5 },
  calDayInner: {
    width: 36, height: 36,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  calDaySelected: {
    backgroundColor: theme.colors.orange,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
  },
  calDayToday: {
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.offWhite,
  },
  calDayNum: { fontSize: 14, lineHeight: 18 },
  modalDivider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginHorizontal: theme.spacing.md,
    marginVertical: 6,
  },

  // ── Time picker (drum) ───────────────────────────────────────────────────────
  timeSectionWrap: {
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },

  // Labels row above the drum
  wheelLabelsRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  wheelLabel: {
    flex: 1,
    textAlign: "center",
  },

  // The unified drum container — ONE border, ONE background, two columns inside
  drumPickerContainer: {
    flexDirection: "row",
    height: WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ROWS,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.white,
    overflow: "hidden",
    position: "relative",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
  },

  // Shared selection highlight — white slot window with black top and bottom rails
  drumHighlightBar: {
    position: "absolute",
    left: theme.spacing.sm,
    right: theme.spacing.sm,
    top: WHEEL_ITEM_HEIGHT * Math.floor(WHEEL_VISIBLE_ROWS / 2),
    height: WHEEL_ITEM_HEIGHT,
    backgroundColor: theme.colors.white,
    borderTopWidth: theme.borders.thick,
    borderBottomWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    zIndex: 0,
  },

  // Fade overlay at the top so non-selected items fade out
  drumFadeTop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: WHEEL_ITEM_HEIGHT * Math.floor(WHEEL_VISIBLE_ROWS / 2),
    zIndex: 2,
  },

  // Fade overlay at the bottom
  drumFadeBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: WHEEL_ITEM_HEIGHT * Math.floor(WHEEL_VISIBLE_ROWS / 2),
    zIndex: 2,
  },

  // Each WheelColumn: borderless, flex:1, clips its scroll content
  wheelColumnWrap: {
    flex: 1,
    height: WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ROWS,
    overflow: "hidden",
    backgroundColor: "transparent",
    zIndex: 1,
  },

  wheelItem: {
    height: WHEEL_ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  wheelItemSelectedText: {
    fontFamily: theme.fonts.heading,
    fontSize: 17,
    lineHeight: 22,
    color: theme.colors.black,
  },
  wheelItemMutedText: {
    fontSize: 15,
    lineHeight: 20,
  },

  meridiemToggleRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  meridiemToggleButton: {
    flex: 1,
    minHeight: 46,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  meridiemToggleButtonSelected: {
    backgroundColor: theme.colors.black,
  },
  meridiemToggleTextSelected: {
    fontFamily: theme.fonts.heading,
  },
  selectedTimeSummary: { paddingTop: theme.spacing.xs, gap: 2 },
  modalFooter: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
});
