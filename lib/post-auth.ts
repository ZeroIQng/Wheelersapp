import { getDriverKycStatus } from "@/lib/api";
import {
  getAuthenticatedRoute,
  type AuthenticatedRoute,
  type StoredAuthState,
} from "@/lib/auth-state";

export type PostAuthRoute =
  | AuthenticatedRoute
  | "/driver/onboarding/pending"
  | "/driver/onboarding/welcome";

/**
 * Where a freshly authenticated user belongs.
 *
 * Drivers must clear KYC before the dashboard is any use to them, so their
 * route depends on the backend's verification state rather than the stored
 * role alone. Every sign-in path has to agree on this — routing straight to
 * the dashboard would drop an unverified driver onto a screen that lets them
 * go online without ever submitting documents.
 */
export async function resolvePostAuthRoute(
  state: StoredAuthState,
  accessToken: string,
): Promise<PostAuthRoute> {
  if (state.role !== "DRIVER") {
    return getAuthenticatedRoute(state);
  }

  try {
    const kyc = await getDriverKycStatus({ accessToken });

    if (kyc.kycStatus === "APPROVED") {
      return "/driver/(tabs)/home";
    }

    if (kyc.kycStatus === "SUBMITTED") {
      return "/driver/onboarding/pending";
    }

    return "/driver/onboarding/welcome";
  } catch {
    // Can't reach the KYC endpoint — send them through onboarding rather than
    // into a dashboard they may not be entitled to use.
    return "/driver/onboarding/welcome";
  }
}
