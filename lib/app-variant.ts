import Constants from "expo-constants";

export type AppVariant = "rider" | "driver";
export type VariantPublicRoute = "/role-selection" | "/account-auth" | "/driver-auth";

const configuredVariant =
  process.env.EXPO_PUBLIC_APP_VARIANT ??
  Constants.expoConfig?.extra?.appVariant;

export const appVariant: AppVariant =
  configuredVariant === "driver" ? "driver" : "rider";

export const isDriverApp = appVariant === "driver";

export const appDisplayName = isDriverApp ? "Wheelers Driver" : "Wheelers";

export const targetAuthRole = isDriverApp ? "DRIVER" : "RIDER";

export const publicEntryRoute: VariantPublicRoute = isDriverApp
  ? "/driver-auth"
  : "/role-selection";

export function isRoleAllowedInVariant(role: "RIDER" | "DRIVER" | "BOTH"): boolean {
  if (role === "BOTH") {
    return true;
  }

  return role === targetAuthRole;
}
