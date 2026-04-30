import * as SecureStore from "expo-secure-store";

export type AppAuthRole = "RIDER" | "DRIVER";

export type StoredAuthState = {
  role: AppAuthRole;
  onboardingComplete: boolean;
};

export type AuthenticatedRoute = "/driver/dashboard" | "/phone-auth" | "/rider";

const AUTH_STATE_KEY = "wheelers.auth.state";

export function getPostLoginRoute(role: AppAuthRole): "/driver/dashboard" | "/phone-auth" {
  return role === "DRIVER" ? "/driver/dashboard" : "/phone-auth";
}

export function getAuthenticatedRoute(state: StoredAuthState): AuthenticatedRoute {
  if (state.role === "DRIVER") {
    return "/driver/dashboard";
  }

  return state.onboardingComplete ? "/rider" : "/phone-auth";
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

    return {
      role: parsed.role,
      onboardingComplete: Boolean(parsed.onboardingComplete),
    };
  } catch {
    return null;
  }
}

export async function writeStoredAuthState(state: StoredAuthState): Promise<void> {
  await SecureStore.setItemAsync(AUTH_STATE_KEY, JSON.stringify(state));
}

export async function persistAuthenticatedRole(role: AppAuthRole): Promise<StoredAuthState> {
  const nextState: StoredAuthState = {
    role,
    onboardingComplete: role === "DRIVER",
  };

  await writeStoredAuthState(nextState);
  return nextState;
}

export async function markStoredOnboardingComplete(): Promise<StoredAuthState | null> {
  const currentState = await readStoredAuthState();
  if (!currentState) {
    return null;
  }

  if (currentState.role !== "RIDER" || currentState.onboardingComplete) {
    return currentState;
  }

  const nextState: StoredAuthState = {
    ...currentState,
    onboardingComplete: true,
  };

  await writeStoredAuthState(nextState);
  return nextState;
}

export async function clearStoredAuthState(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_STATE_KEY);
}
