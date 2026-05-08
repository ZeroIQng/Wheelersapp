import { forwardRef } from "react";
import { Platform } from "react-native";
import MapView, {
  PROVIDER_GOOGLE,
  type MapViewProps,
} from "react-native-maps";

const googleProvider =
  Platform.OS === "android" || Platform.OS === "ios"
    ? PROVIDER_GOOGLE
    : undefined;

export const GoogleMapView = forwardRef<MapView, MapViewProps>(
  function GoogleMapView(props, ref) {
    return <MapView {...props} provider={googleProvider} ref={ref} />;
  },
);
