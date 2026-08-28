import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { BackgroundLocationDisclosure } from "@/components/BackgroundLocationDisclosure";
import { setPlaceSearchBias } from "@/lib/google-places";

/**
 * Persisted marker that the user explicitly tapped "Not now" on the Play
 * prominent-disclosure screen. Automatic (non user-initiated) requests skip the
 * disclosure while this is set so we don't nag on every trip; a user-initiated
 * request can pass `{ force: true }` to show it again.
 */
const BACKGROUND_DISCLOSURE_DECLINED_KEY = "wheelers.backgroundLocation.disclosureDeclined";

type AppLocation = {
  lat: number;
  lng: number;
  address: string;
};

type LocationPermissionState = "idle" | "granted" | "denied";

type RequestBackgroundOptions = {
  /**
   * Show the prominent disclosure even if the user previously declined it.
   * Use for explicit user actions (e.g. a settings toggle), never for
   * automatic prompts.
   */
  force?: boolean;
};

type LocationContextValue = {
  permissionState: LocationPermissionState;
  backgroundGranted: boolean;
  currentLocation: AppLocation | null;
  error: string | null;
  requestLocationAccess: () => Promise<void>;
  requestBackgroundLocationAccess: (options?: RequestBackgroundOptions) => Promise<void>;
  refreshLocation: () => Promise<void>;
};

const defaultValue: LocationContextValue = {
  permissionState: "idle",
  backgroundGranted: false,
  currentLocation: null,
  error: null,
  requestLocationAccess: async () => undefined,
  requestBackgroundLocationAccess: async () => undefined,
  refreshLocation: async () => undefined,
};

const LocationContext = createContext<LocationContextValue>(defaultValue);

function formatAddress(parts: Location.LocationGeocodedAddress[]): string | null {
  const first = parts[0];
  if (!first) {
    return null;
  }

  return [
    first.name,
    first.street,
    first.district,
    first.city,
    first.region,
  ]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .filter((part, index, list) => list.findIndex((item) => item.toLowerCase() === part.toLowerCase()) === index)
    .join(", ");
}

async function resolveAddress(lat: number, lng: number): Promise<string> {
  try {
    const address = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    return formatAddress(address) ?? `Current location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  } catch {
    return `Current location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [permissionState, setPermissionState] = useState<LocationPermissionState>("idle");
  const [backgroundGranted, setBackgroundGranted] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<AppLocation | null>(null);

  // Place search ranks results by distance from the rider. Without this it has
  // no idea where they are and falls back to no bias at all.
  useEffect(() => {
    setPlaceSearchBias(
      currentLocation ? { lat: currentLocation.lat, lng: currentLocation.lng } : null,
    );
  }, [currentLocation]);
  const [error, setError] = useState<string | null>(null);
  const [disclosureVisible, setDisclosureVisible] = useState(false);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const disclosureResolverRef = useRef<((accepted: boolean) => void) | null>(null);

  /**
   * Google Play "Prominent Disclosure and Consent" requirement: before the
   * ACCESS_BACKGROUND_LOCATION runtime prompt we must show an in-app screen
   * that explains what is collected, why, and that it happens even when the
   * app is closed, and the user must affirmatively accept it. This resolves
   * `true` only when the user taps "Allow" on that screen.
   */
  const showBackgroundDisclosure = useCallback((): Promise<boolean> => {
    // If a disclosure is already open, resolve the previous waiter as declined
    // so it never hangs, then hand the modal to the new caller.
    disclosureResolverRef.current?.(false);
    return new Promise<boolean>((resolve) => {
      disclosureResolverRef.current = resolve;
      setDisclosureVisible(true);
    });
  }, []);

  const settleDisclosure = useCallback((accepted: boolean) => {
    setDisclosureVisible(false);
    const resolve = disclosureResolverRef.current;
    disclosureResolverRef.current = null;
    resolve?.(accepted);
  }, []);

  const updateCurrentLocation = useCallback(
    async (
      latitude: number,
      longitude: number,
      providedAddress?: string | null,
    ) => {
      const address = providedAddress ?? (await resolveAddress(latitude, longitude));
      setCurrentLocation({
        lat: latitude,
        lng: longitude,
        address,
      });
    },
    [],
  );

  const startWatchingLocation = useCallback(async () => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 25,
        timeInterval: 15_000,
      },
      (position) => {
        void updateCurrentLocation(
          position.coords.latitude,
          position.coords.longitude,
        );
      },
    );
  }, [updateCurrentLocation]);

  const refreshLocation = useCallback(async (): Promise<void> => {
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      await updateCurrentLocation(
        position.coords.latitude,
        position.coords.longitude,
      );
      setError(null);
    } catch (locationError) {
      setError(
        locationError instanceof Error
          ? locationError.message
          : "Could not read your current location.",
      );
    }
  }, [updateCurrentLocation]);

  const requestLocationAccess = useCallback(async (): Promise<void> => {
    try {
      const foreground = await Location.getForegroundPermissionsAsync();
      const foregroundResult = foreground.granted
        ? foreground
        : await Location.requestForegroundPermissionsAsync();

      if (!foregroundResult.granted) {
        setPermissionState("denied");
        setError("Location access is disabled.");
        return;
      }

      setPermissionState("granted");
      setError(null);
      await refreshLocation();
      await startWatchingLocation();
    } catch (locationError) {
      setPermissionState("denied");
      setError(
        locationError instanceof Error
          ? locationError.message
          : "Could not start location tracking.",
      );
    }
  }, [refreshLocation, startWatchingLocation]);

  const requestBackgroundLocationAccess = useCallback(
    async (options?: RequestBackgroundOptions): Promise<void> => {
      try {
        const foreground = await Location.getForegroundPermissionsAsync();
        if (!foreground.granted) {
          await requestLocationAccess();
        }

        const refreshedForeground = await Location.getForegroundPermissionsAsync();
        if (!refreshedForeground.granted) {
          setBackgroundGranted(false);
          return;
        }

        const background = await Location.getBackgroundPermissionsAsync();
        if (background.granted) {
          setBackgroundGranted(true);
          return;
        }

        // Nothing more we can do if the OS won't ask again; avoid showing a
        // disclosure that leads nowhere.
        if (!background.canAskAgain) {
          setBackgroundGranted(false);
          return;
        }

        if (!options?.force) {
          const declined = await AsyncStorage.getItem(BACKGROUND_DISCLOSURE_DECLINED_KEY);
          if (declined) {
            setBackgroundGranted(false);
            return;
          }
        }

        // Prominent disclosure MUST precede the runtime permission prompt.
        const accepted = await showBackgroundDisclosure();
        if (!accepted) {
          await AsyncStorage.setItem(BACKGROUND_DISCLOSURE_DECLINED_KEY, "1");
          setBackgroundGranted(false);
          return;
        }

        await AsyncStorage.removeItem(BACKGROUND_DISCLOSURE_DECLINED_KEY);
        const backgroundResult = await Location.requestBackgroundPermissionsAsync();
        setBackgroundGranted(backgroundResult.granted);
      } catch (locationError) {
        setBackgroundGranted(false);
        setError(
          locationError instanceof Error
            ? locationError.message
            : "Could not enable background location.",
        );
      }
    },
    [requestLocationAccess, showBackgroundDisclosure],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const foreground = await Location.getForegroundPermissionsAsync();
        if (!foreground.granted) {
          if (!cancelled) {
            setPermissionState("idle");
            setBackgroundGranted(false);
          }
          return;
        }

        if (!cancelled) {
          setPermissionState("granted");
          setError(null);
        }

        await refreshLocation();

        const background = await Location.getBackgroundPermissionsAsync();
        if (!cancelled) {
          setBackgroundGranted(background.granted);
        }

        await startWatchingLocation();
      } catch (locationError) {
        if (!cancelled) {
          setPermissionState("denied");
          setError(
            locationError instanceof Error
              ? locationError.message
              : "Could not start location tracking.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      disclosureResolverRef.current?.(false);
      disclosureResolverRef.current = null;
    };
  }, [refreshLocation, startWatchingLocation]);

  const value = useMemo<LocationContextValue>(
    () => ({
      permissionState,
      backgroundGranted,
      currentLocation,
      error,
      requestLocationAccess,
      requestBackgroundLocationAccess,
      refreshLocation,
    }),
    [
      backgroundGranted,
      currentLocation,
      error,
      permissionState,
      refreshLocation,
      requestBackgroundLocationAccess,
      requestLocationAccess,
    ],
  );

  return (
    <LocationContext.Provider value={value}>
      {children}
      <BackgroundLocationDisclosure
        visible={disclosureVisible}
        onAccept={() => settleDisclosure(true)}
        onDecline={() => settleDisclosure(false)}
      />
    </LocationContext.Provider>
  );
}

export function useAppLocation(): LocationContextValue {
  return useContext(LocationContext);
}
