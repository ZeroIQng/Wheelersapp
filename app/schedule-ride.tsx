import MaterialIcons from "@expo/vector-icons/MaterialIcons";
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

import { AppButton } from "@/components/app-button";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { BackArrow } from "@/components/back-arrow";
import {
  fetchGooglePlaceSuggestions,
  isGoogleMapsConfigured,
  type PlaceSuggestion,
} from "@/lib/google-places";
import {
  MAX_ADDITIONAL_STOPS,
  moveRouteStop,
  serializeRideItinerary,
  type RideItinerary,
} from "@/lib/ride-route";
import { useAppLocation } from "@/lib/location";
import { theme } from "@/theme";

// ─── Calendar helpers ─────────────────────────────────────────────────────────

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Pad to full rows
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function getTimeSlots(selectedDate: Date) {
  const slots: { label: string; value: Date }[] = [];
  const now = new Date();
  const isToday = selectedDate.toDateString() === now.toDateString();
  const base = new Date(selectedDate);
  base.setSeconds(0, 0);

  if (isToday) {
    const minTime = new Date(now.getTime() + 30 * 60 * 1000);
    base.setHours(
      minTime.getHours(),
      Math.ceil(minTime.getMinutes() / 15) * 15,
      0,
      0,
    );
  } else {
    base.setHours(6, 0, 0, 0);
  }

  for (let i = 0; i < 68; i++) {
    const slot = new Date(base.getTime() + i * 15 * 60 * 1000);
    if (slot.getHours() >= 23) break;
    slots.push({
      label: slot.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
      value: slot,
    });
  }
  return slots;
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

const DRAG_SWAP_THRESHOLD = 88;

// ─── Types ────────────────────────────────────────────────────────────────────

type ScreenMode = "form" | "search";
type ActiveField =
  | { type: "pickup" }
  | { type: "stop"; index: number }
  | { type: "destination" };

// ─── Calendar Modal ───────────────────────────────────────────────────────────

function ScheduleModal({
  visible,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (date: Date, time: Date) => void;
}) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date>(now);
  const [selectedTimeIndex, setSelectedTimeIndex] = useState(0);

  const timeSlots = useMemo(() => getTimeSlots(selectedDate), [selectedDate]);

  // Reset time when date changes
  useEffect(() => {
    setSelectedTimeIndex(0);
  }, [selectedDate]);

  const calendarDays = useMemo(
    () => getCalendarDays(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

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
    const d = new Date(viewYear, viewMonth, day);
    return d.toDateString() === now.toDateString();
  };

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleDayPress = (day: number) => {
    if (isDateDisabled(day)) return;
    setSelectedDate(new Date(viewYear, viewMonth, day));
  };

  const selectedTime = timeSlots[selectedTimeIndex];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose} />
      <View style={styles.modalSheet}>
        {/* Sheet handle */}
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
          {/* Month nav */}
          <View style={styles.monthNav}>
            <Pressable onPress={goToPrevMonth} style={styles.monthNavBtn}>
              <MaterialIcons
                name="chevron-left"
                size={22}
                color={theme.colors.black}
              />
            </Pressable>
            <AppText variant="bodyMedium">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </AppText>
            <Pressable onPress={goToNextMonth} style={styles.monthNavBtn}>
              <MaterialIcons
                name="chevron-right"
                size={22}
                color={theme.colors.black}
              />
            </Pressable>
          </View>

          {/* Day-of-week header */}
          <View style={styles.calendarGrid}>
            {DAY_LABELS.map((d) => (
              <View key={d} style={styles.calCell}>
                <AppText
                  variant="monoSmall"
                  color={theme.colors.muted}
                  style={styles.calDayLabel}
                >
                  {d}
                </AppText>
              </View>
            ))}

            {/* Day cells */}
            {calendarDays.map((day, idx) => {
              if (day === null) {
                return <View key={`empty-${idx}`} style={styles.calCell} />;
              }
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
                      color={
                        disabled
                          ? "#CCC"
                          : selected
                            ? theme.colors.white
                            : theme.colors.black
                      }
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

        {/* Divider */}
        <View style={styles.modalDivider} />

        {/* ── Time picker ── */}
        <View style={styles.timeSectionWrap}>
          <AppText variant="monoSmall" color={theme.colors.muted}>
            TIME
          </AppText>
          {timeSlots.length === 0 ? (
            <AppText variant="bodySmall" color={theme.colors.muted}>
              No slots available — pick a different date.
            </AppText>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.timeChipRow}
              keyboardShouldPersistTaps="handled"
            >
              {timeSlots.map((slot, index) => {
                const selected = selectedTimeIndex === index;
                return (
                  <Pressable
                    key={index}
                    onPress={() => setSelectedTimeIndex(index)}
                    style={[
                      styles.timeChip,
                      selected ? styles.timeChipSelected : null,
                    ]}
                  >
                    <AppText
                      variant="bodyMedium"
                      color={selected ? theme.colors.white : theme.colors.black}
                    >
                      {slot.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Confirm */}
        <View style={styles.modalFooter}>
          <AppButton
            disabled={!selectedTime}
            title={
              selectedTime
                ? `Confirm — ${formatScheduleLabel(selectedDate, selectedTime.value)}`
                : "Select a time"
            }
            onPress={() => {
              if (selectedTime) onConfirm(selectedDate, selectedTime.value);
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

// ─── Route sub-components ─────────────────────────────────────────────────────

function SearchTriggerField({
  color,
  label,
  marker,
  onPress,
  value,
}: {
  color: string;
  label: string;
  marker: "circle" | "square";
  onPress: () => void;
  value: string;
}) {
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
      <View
        style={[
          styles.triggerField,
          isEditing ? styles.routeInputActive : null,
        ]}
      >
        <View
          style={[
            styles.markerSquare,
            { backgroundColor: theme.colors.orange },
          ]}
        />
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
            style={[
              styles.markerSquare,
              { backgroundColor: theme.colors.orangeLight },
            ]}
          />
          <TextInput
            onChangeText={onChangeText}
            onFocus={onFocus}
            onSubmitEditing={onSubmitEditing}
            placeholder="Add a stop"
            placeholderTextColor="#A59B92"
            style={styles.inlineInput}
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

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ScheduleRideScreen() {
  const router = useRouter();
  const { currentLocation } = useAppLocation();

  // Route state
  const [mode, setMode] = useState<ScreenMode>("form");
  const [activeField, setActiveField] = useState<ActiveField>({ type: "pickup" });
  const [pickupValue, setPickupValue] = useState("");
  const [routeStops, setRouteStops] = useState<string[]>([""]);
  const [activeRouteIndex, setActiveRouteIndex] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [providerSuggestions, setProviderSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Schedule state
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [scheduledTime, setScheduledTime] = useState<Date | null>(null);

  const inputRef = useRef<TextInput>(null);

  const destinationValue = routeStops[routeStops.length - 1] ?? "";
  const intermediateStops = routeStops.slice(0, -1);

  // Focus search input
  useEffect(() => {
    if (mode !== "search") return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [activeField, mode]);

  useEffect(() => {
    if (!currentLocation?.address || pickupValue.trim().length > 0) {
      return;
    }

    setPickupValue(currentLocation.address);
  }, [currentLocation?.address, pickupValue]);

  // Google place search
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
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
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

  // Route handlers
  const openSearch = (field: ActiveField) => {
    setActiveRouteIndex(null);
    setActiveField(field);
    const currentVal =
      field.type === "pickup"
        ? pickupValue
        : field.type === "destination"
          ? destinationValue
          : (routeStops[(field as { type: "stop"; index: number }).index] ?? "");
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

  const handleSuggestionPress = (value: string) => {
    Keyboard.dismiss();
    if (mode === "search") {
      if (activeField.type === "pickup") {
        setPickupValue(value);
      } else if (activeField.type === "destination") {
        setRouteStops((cur) =>
          cur.map((s, i) => (i === cur.length - 1 ? value : s)),
        );
      } else {
        const idx = (activeField as { type: "stop"; index: number }).index;
        setRouteStops((cur) => cur.map((s, i) => (i === idx ? value : s)));
      }
      setMode("form");
      setSearchQuery("");
      return;
    }
    if (activeRouteIndex != null) {
      setRouteStops((cur) =>
        cur.map((s, i) => (i === activeRouteIndex ? value : s)),
      );
      setActiveRouteIndex(null);
      setSearchQuery("");
    }
  };

  const handleAddStop = () => {
    if (intermediateStops.length >= MAX_ADDITIONAL_STOPS) return;
    const insertIndex = routeStops.length - 1;
    setRouteStops((cur) => {
      const next = [...cur];
      next.splice(insertIndex, 0, "");
      return next;
    });
    setActiveRouteIndex(insertIndex);
  };

  const handleRemoveStop = (index: number) => {
    if (activeRouteIndex === index) {
      setActiveRouteIndex(null);
      setSearchQuery("");
    }
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
    setRouteStops((cur) =>
      cur.map((s, i) => (i === cur.length - 1 ? value : s)),
    );
    setSearchQuery(value);
  };

  const handleStopChange = (index: number, value: string) => {
    setRouteStops((cur) => cur.map((s, i) => (i === index ? value : s)));
    setSearchQuery(value);
  };

  // Derived
  const canAddStop =
    intermediateStops.length < MAX_ADDITIONAL_STOPS &&
    destinationValue.trim().length > 0 &&
    intermediateStops.every((s) => s.trim().length > 0);
  const maxStopsReached = intermediateStops.length >= MAX_ADDITIONAL_STOPS;
  const hasExtraStops = intermediateStops.length > 0;
  const showInlineResults = activeRouteIndex != null;

  const isConfirmDisabled =
    !pickupValue.trim() ||
    !destinationValue.trim() ||
    intermediateStops.some((s) => s.trim().length === 0) ||
    !scheduledDate ||
    !scheduledTime;

  const itinerary: RideItinerary = { pickup: pickupValue, stops: routeStops };
  const serializedItinerary = serializeRideItinerary(itinerary);
  const scheduleLabel =
    scheduledDate && scheduledTime
      ? formatScheduleLabel(scheduledDate, scheduledTime)
      : null;

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

      {/* Calendar modal */}
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
                  Set route & pick a time — up to 7 days ahead
                </AppText>
              </View>
              <View style={styles.clockBadge}>
                <MaterialIcons
                  name="schedule"
                  size={18}
                  color={theme.colors.orange}
                />
              </View>
            </View>

            <ScrollView
              bounces={false}
              contentContainerStyle={styles.formScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Route card */}
              <View style={styles.formSheet}>
                <View
                  style={[
                    styles.formConnector,
                    { height: 40 + (intermediateStops.length + 1) * 78 },
                  ]}
                />

                <SearchTriggerField
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
                        isEditing={activeRouteIndex === index}
                        isDragging={draggingIndex === index}
                        key={`stop-${index}`}
                        label={`Stop ${index + 1}`}
                        onChangeText={(v) => handleStopChange(index, v)}
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

              {/* ── Schedule trigger row ── */}
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
                        Tap to open calendar
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
            </ScrollView>

            {/* Footer */}
            <View style={styles.footerActionBar}>
              <AppButton
                disabled={isConfirmDisabled}
                title="Schedule ride"
                onPress={() => {
                  router.push({
                    pathname: "/ride-selection",
                    params: {
                      itinerary: serializedItinerary,
                      scheduledAt: scheduledTime?.toISOString() ?? "",
                    },
                  });
                }}
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: theme.spacing.lg, paddingBottom: 0 },
  content: { flex: 1 },
  modeLayout: { flex: 1, gap: theme.spacing.md, overflow: "hidden" },

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
  formConnector: {
    position: "absolute",
    left: 27,
    top: 56,
    width: 2,
    backgroundColor: theme.colors.borderLight,
  },

  triggerFieldBlock: { gap: theme.spacing.xs },
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

  // Schedule trigger
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
    width: 38,
    height: 38,
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

  // ── Calendar modal ──
  modalOverlay: {
    flex: 1,
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
    paddingBottom: 36,
  },
  sheetHandleWrap: { alignItems: "center", paddingTop: 12, paddingBottom: 4 },
  sheetHandle: {
    width: 44,
    height: 5,
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
    width: 34,
    height: 34,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.offWhite,
  },

  // Calendar
  calendarWrap: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  monthNavBtn: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.offWhite,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calCell: {
    width: "14.285%",
    alignItems: "center",
    paddingVertical: 3,
  },
  calDayLabel: {
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.5,
  },
  calDayInner: {
    width: 36,
    height: 36,
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
  calDayNum: {
    fontSize: 14,
    lineHeight: 18,
  },

  modalDivider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.sm,
  },

  // Time picker
  timeSectionWrap: {
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  timeChipRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingBottom: 2,
  },
  timeChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.offWhite,
    minWidth: 80,
    alignItems: "center",
  },
  timeChipSelected: {
    backgroundColor: theme.colors.orange,
    borderColor: theme.colors.black,
  },

  modalFooter: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
});
