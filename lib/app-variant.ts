import Constants from "expo-constants";

export type AppVariant = "rider" | "driver";
export type VariantPublicRoute = "/rider-auth" | "/account-auth" | "/driver-auth";

const configuredVariant =
  process.env.EXPO_PUBLIC_APP_VARIANT ??
  Constants.expoConfig?.extra?.appVariant;

export const appVariant: AppVariant =
  configuredVariant === "driver" ? "driver" : "rider";

export const isDriverApp = appVariant === "driver";

export const appDisplayName = isDriverApp ? "Wheelers Driver" : "Wheelers";

export const targetAuthRole = isDriverApp ? "DRIVER" : "RIDER";

// Riders sign in with Apple, Google or email and go straight into the app.
// There is no role to choose (the variant decides that) and no phone step.
export const publicEntryRoute: VariantPublicRoute = isDriverApp
  ? "/driver-auth"
  : "/rider-auth";

export function isRoleAllowedInVariant(role: "RIDER" | "DRIVER" | "BOTH"): boolean {
  if (role === "BOTH") {
    return true;
  }

  return role === targetAuthRole;
}
