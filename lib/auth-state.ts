import * as SecureStore from "expo-secure-store";

export type AppAuthRole = "RIDER" | "DRIVER";
export type RiderOnboardingRoute = "/phone-auth" | "/otp-verify" | "/rider";
export type AuthenticatedRoute = "/driver/dashboard" | RiderOnboardingRoute;

export type StoredAuthState = {
  role: AppAuthRole;
  onboardingComplete: boolean;
  onboardingRoute: AuthenticatedRoute;
  pendingPhone: string | null;
};

const AUTH_STATE_KEY = "wheelers.auth.state";

export function getPostLoginRoute(role: AppAuthRole): "/driver/dashboard" | "/phone-auth" {
  return role === "DRIVER" ? "/driver/dashboard" : "/phone-auth";
}

export function getAuthenticatedRoute(state: StoredAuthState): AuthenticatedRoute {
  if (state.role === "DRIVER") {
    return "/driver/dashboard";
  }

  if (state.onboardingComplete) {
    return "/rider";
  }

  if (state.onboardingRoute === "/otp-verify" && state.pendingPhone) {
    return "/otp-verify";
  }

  return "/phone-auth";
}

export async function readStoredAuthState(): Promise<StoredAuthState | null> {
  try {
    const raw = await SecureStore.getItemAsync(AUTH_STATE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredAuthState>;
    if (parsed.role !== "RIDER" && parsed.role !== "DRIVER") {
      return null;
    }

    const onboardingRoute =
      parsed.onboardingRoute === "/driver/dashboard" ||
      parsed.onboardingRoute === "/phone-auth" ||
      parsed.onboardingRoute === "/otp-verify" ||
      parsed.onboardingRoute === "/rider"
        ? parsed.onboardingRoute
        : parsed.role === "DRIVER"
          ? "/driver/dashboard"
          : "/phone-auth";

    return {
      role: parsed.role,
      onboardingComplete: Boolean(parsed.onboardingComplete),
      onboardingRoute,
      pendingPhone: typeof parsed.pendingPhone === "string" ? parsed.pendingPhone : null,
    };
  } catch {
    return null;
  }
}

export async function writeStoredAuthState(state: StoredAuthState): Promise<void> {
  await SecureStore.setItemAsync(AUTH_STATE_KEY, JSON.stringify(state));
}

export async function persistAuthenticatedRole(
  role: AppAuthRole,
  options?: { phoneVerified?: boolean },
): Promise<StoredAuthState> {
  const phoneVerified = options?.phoneVerified === true;
  const nextState: StoredAuthState = {
    role,
    onboardingComplete: role === "DRIVER" || phoneVerified,
    onboardingRoute:
      role === "DRIVER"
        ? "/driver/dashboard"
        : phoneVerified
          ? "/rider"
          : "/phone-auth",
    pendingPhone: null,
  };

  await writeStoredAuthState(nextState);
  return nextState;
}

export async function storePendingPhoneVerification(phone: string): Promise<StoredAuthState | null> {
  const currentState = await readStoredAuthState();
  if (!currentState || currentState.role !== "RIDER") {
    return null;
  }

  const nextState: StoredAuthState = {
    ...currentState,
    onboardingComplete: false,
    onboardingRoute: "/otp-verify",
    pendingPhone: phone,
  };

  await writeStoredAuthState(nextState);
  return nextState;
}

export async function storePhoneEntryStep(): Promise<StoredAuthState | null> {
  const currentState = await readStoredAuthState();
  if (!currentState || currentState.role !== "RIDER") {
    return null;
  }

  const nextState: StoredAuthState = {
    ...currentState,
    onboardingComplete: false,
    onboardingRoute: "/phone-auth",
    pendingPhone: null,
  };

  await writeStoredAuthState(nextState);
  return nextState;
}

export async function markStoredOnboardingComplete(): Promise<StoredAuthState | null> {
  const currentState = await readStoredAuthState();
  if (!currentState) {
    return null;
  }

  if (currentState.role !== "RIDER") {
    return currentState;
  }

  const nextState: StoredAuthState = {
    ...currentState,
    onboardingComplete: true,
    onboardingRoute: "/rider",
    pendingPhone: null,
  };

  await writeStoredAuthState(nextState);
  return nextState;
}

export async function clearStoredAuthState(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_STATE_KEY);
}
