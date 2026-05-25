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

type AppLocation = {
  lat: number;
  lng: number;
  address: string;
};

type LocationPermissionState = "idle" | "granted" | "denied";

type LocationContextValue = {
  permissionState: LocationPermissionState;
  backgroundGranted: boolean;
  currentLocation: AppLocation | null;
  error: string | null;
  requestLocationAccess: () => Promise<void>;
  requestBackgroundLocationAccess: () => Promise<void>;
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
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

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

  const requestBackgroundLocationAccess = useCallback(async (): Promise<void> => {
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
      const backgroundResult = background.granted
        ? background
        : await Location.requestBackgroundPermissionsAsync();

      setBackgroundGranted(backgroundResult.granted);
    } catch (locationError) {
      setBackgroundGranted(false);
      setError(
        locationError instanceof Error
          ? locationError.message
          : "Could not enable background location.",
      );
    }
  }, [requestLocationAccess]);

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

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useAppLocation(): LocationContextValue {
  return useContext(LocationContext);
}
