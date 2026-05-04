import { PropsWithChildren, useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import MapView, { Marker, Polyline, type EdgePadding, type LatLng } from "react-native-maps";

import type {
  RideEstimateWaypoint,
  RideMapCoordinate,
  RideRouteGeometry,
} from "@/lib/api";
import { theme } from "@/theme";

type LiveMapProps = PropsWithChildren<{
  height?: number;
  roundedTop?: boolean;
  route?: RideRouteGeometry | null;
  pickup?: RideEstimateWaypoint | null;
  destination?: RideEstimateWaypoint | null;
  stops?: RideEstimateWaypoint[];
  driverLocation?: RideMapCoordinate | null;
  initialCenter?: RideMapCoordinate | null;
  initialDelta?: {
    latitudeDelta: number;
    longitudeDelta: number;
  };
  fitPadding?: Partial<EdgePadding>;
}>;

const defaultInitialDelta = {
  latitudeDelta: 0.045,
  longitudeDelta: 0.035,
};

export function LiveMap({
  children,
  height = 280,
  roundedTop,
  route,
  pickup,
  destination,
  stops = [],
  driverLocation,
  initialCenter,
  initialDelta = defaultInitialDelta,
  fitPadding,
}: LiveMapProps) {
  const mapRef = useRef<MapView | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const lastFitSignatureRef = useRef<string | null>(null);

  const routePolyline = useMemo(
    () => (route?.coordinates ?? []).map(toLatLng),
    [route?.coordinates],
  );
  const fitCoordinates = useMemo(() => {
    if (routePolyline.length >= 2) {
      return routePolyline;
    }

    return [pickup, ...stops, destination]
      .filter((point): point is RideEstimateWaypoint => point != null)
      .map(toLatLng);
  }, [destination, pickup, routePolyline, stops]);
  const resolvedPadding = useMemo<EdgePadding>(
    () => ({
      top: fitPadding?.top ?? 56,
      right: fitPadding?.right ?? 40,
      bottom: fitPadding?.bottom ?? 56,
      left: fitPadding?.left ?? 40,
    }),
    [fitPadding],
  );
  const initialRegion = useMemo(() => {
    if (route?.bounds) {
      const centerLatitude =
        (route.bounds.northEast.lat + route.bounds.southWest.lat) / 2;
      const centerLongitude =
        (route.bounds.northEast.lng + route.bounds.southWest.lng) / 2;

      return {
        latitude: centerLatitude,
        longitude: centerLongitude,
        latitudeDelta: Math.max(
          Math.abs(route.bounds.northEast.lat - route.bounds.southWest.lat) * 1.35,
          0.012,
        ),
        longitudeDelta: Math.max(
          Math.abs(route.bounds.northEast.lng - route.bounds.southWest.lng) * 1.35,
          0.012,
        ),
      };
    }

    const center = initialCenter ?? pickup ?? destination ?? driverLocation ?? stops[0];

    return {
      latitude: center?.lat ?? 6.4365,
      longitude: center?.lng ?? 3.4553,
      latitudeDelta: initialDelta.latitudeDelta,
      longitudeDelta: initialDelta.longitudeDelta,
    };
  }, [destination, driverLocation, initialCenter, initialDelta, pickup, route?.bounds, stops]);
  const fitSignature = useMemo(
    () =>
      fitCoordinates
        .map((coordinate) => `${coordinate.latitude.toFixed(5)}:${coordinate.longitude.toFixed(5)}`)
        .join("|"),
    [fitCoordinates],
  );

  useEffect(() => {
    if (!mapReady || !mapRef.current || fitCoordinates.length < 2 || !fitSignature) {
      return;
    }

    if (lastFitSignatureRef.current === fitSignature) {
      return;
    }

    lastFitSignatureRef.current = fitSignature;
    mapRef.current.fitToCoordinates(fitCoordinates, {
      edgePadding: resolvedPadding,
      animated: false,
    });
  }, [fitCoordinates, fitSignature, mapReady, resolvedPadding]);

  return (
    <View
      style={[
        styles.container,
        {
          height,
          borderTopLeftRadius: roundedTop ? theme.radius.lg : 0,
          borderTopRightRadius: roundedTop ? theme.radius.lg : 0,
        },
      ]}
    >
      <MapView
        initialRegion={initialRegion}
        mapPadding={Platform.select({ ios: undefined, default: undefined })}
        onMapReady={() => setMapReady(true)}
        pitchEnabled={false}
        rotateEnabled={false}
        scrollEnabled
        showsBuildings
        showsCompass={false}
        showsIndoors={false}
        showsTraffic
        style={StyleSheet.absoluteFill}
        toolbarEnabled={false}
        ref={mapRef}
      >
        {routePolyline.length >= 2 ? (
          <Polyline
            coordinates={routePolyline}
            strokeColor={theme.colors.orange}
            strokeWidth={5}
          />
        ) : null}

        {pickup ? (
          <Marker coordinate={toLatLng(pickup)}>
            <View style={[styles.marker, styles.pickupMarker]} />
          </Marker>
        ) : null}

        {stops.map((stop, index) => (
          <Marker key={`${stop.address}-${index}`} coordinate={toLatLng(stop)}>
            <View style={[styles.marker, styles.stopMarker]} />
          </Marker>
        ))}

        {destination ? (
          <Marker coordinate={toLatLng(destination)}>
            <View style={[styles.marker, styles.destinationMarker]} />
          </Marker>
        ) : null}

        {driverLocation ? (
          <Marker coordinate={toLatLng(driverLocation)}>
            <View style={[styles.marker, styles.driverMarker]}>
              <View style={styles.driverInner} />
            </View>
          </Marker>
        ) : null}
      </MapView>

      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {children}
      </View>
    </View>
  );
}

function toLatLng(value: RideEstimateWaypoint | RideMapCoordinate): LatLng {
  return {
    latitude: value.lat,
    longitude: value.lng,
  };
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.mapBase,
    overflow: "hidden",
    position: "relative",
  },
  marker: {
    borderColor: theme.colors.black,
    borderWidth: theme.borders.thick,
    ...theme.shadows.card,
  },
  pickupMarker: {
    width: 16,
    height: 16,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.orange,
  },
  stopMarker: {
    width: 14,
    height: 14,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.white,
  },
  destinationMarker: {
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: theme.colors.green,
  },
  driverMarker: {
    width: 24,
    height: 24,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.black,
  },
  driverInner: {
    width: 10,
    height: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.white,
  },
});
