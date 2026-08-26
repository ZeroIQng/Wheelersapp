import { Alert } from "react-native";

type GoogleSigninModule = {
  configure: (options: { iosClientId?: string; webClientId: string }) => void;
  hasPlayServices: () => Promise<boolean>;
  signIn: () => Promise<{ data?: { idToken?: string | null } | null }>;
};

/**
 * Resolve the Google Sign-In module at call time.
 *
 * It is imported lazily so a build without the native module still renders the
 * sign-in screen instead of crashing on load — `TurboModuleRegistry.getEnforcing`
 * throws the moment the package is evaluated.
 *
 * Two shapes have to be tolerated: the package re-exports `GoogleSignin` from a
 * nested module, and under Metro's interop a dynamic import can surface that as
 * either a named export or one hanging off `default`.
 *
 * Returns null (after alerting) when the module cannot be used, so callers can
 * simply bail.
 */
export async function loadGoogleSignin(): Promise<GoogleSigninModule | null> {
  let resolved: GoogleSigninModule | undefined;

  try {
    const imported = (await import("@react-native-google-signin/google-signin")) as unknown as {
      GoogleSignin?: GoogleSigninModule;
      default?: { GoogleSignin?: GoogleSigninModule };
    };
    resolved = imported.GoogleSignin ?? imported.default?.GoogleSignin;
  } catch (error) {
    // getEnforcing throws here when the native module is absent from the build.
    Alert.alert(
      "Google sign-in unavailable",
      "This build does not include the Google Sign-In native module. Run `pod install` and rebuild the app — reloading JavaScript cannot add it.",
    );
    console.warn("[google-signin] import failed", error);
    return null;
  }

  if (typeof resolved?.configure !== "function") {
    Alert.alert(
      "Google sign-in unavailable",
      "The Google Sign-In module loaded but is missing its native binding. Run `pod install` and rebuild the app — reloading JavaScript cannot add it.",
    );
    return null;
  }

  return resolved;
}

/**
 * The OAuth web client id every variant signs in against. Returns null (after
 * alerting) when the build was made without it — Google otherwise fails with an
 * opaque DEVELOPER_ERROR.
 */
export function getGoogleWebClientId(): string | null {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? "";
  if (!webClientId) {
    Alert.alert(
      "Google sign-in not configured",
      "This build is missing EXPO_PUBLIC_GOOGLE_CLIENT_ID. Rebuild with a profile that sets it.",
    );
    return null;
  }

  return webClientId;
}

export function getGoogleIosClientId(): string | undefined {
  return process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || undefined;
}
