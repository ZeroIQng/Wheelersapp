import { useState } from "react";
import { useRouter } from "expo-router";
import { Alert } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";

import { AuthEntryScreen, type AuthProvider } from "@/components/auth-entry";
import { signInWithApple, signInWithGoogle, getDriverKycStatus } from "@/lib/api";
import { storeLocalAccessToken } from "@/lib/access-token";
import { persistAuthenticatedRole } from "@/lib/auth-state";
import { useAuth } from "@/lib/auth";
import {
  getGoogleIosClientId,
  getGoogleWebClientId,
  loadGoogleSignin,
} from "@/lib/google-signin";

export default function DriverAuthScreen() {
  const router = useRouter();
  const { refreshAuthState } = useAuth();
  const [loadingProvider, setLoadingProvider] = useState<AuthProvider | null>(null);

  async function handleAppleSignIn() {
    try {
      setLoadingProvider("apple");

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        Alert.alert("Error", "Apple did not return an identity token.");
        return;
      }

      const name =
        credential.fullName?.givenName || credential.fullName?.familyName
          ? [credential.fullName.givenName, credential.fullName.familyName]
              .filter(Boolean)
              .join(" ")
          : undefined;

      const result = await signInWithApple({
        idToken: credential.identityToken,
        name,
      });

      await storeLocalAccessToken(result.accessToken);
      await persistAuthenticatedRole("DRIVER");
      await refreshAuthState();

      // Check KYC status — skip onboarding if already approved
      try {
        const kyc = await getDriverKycStatus({ accessToken: result.accessToken });
        if (kyc.kycStatus === "APPROVED") {
          router.replace("/driver/(tabs)/home" as any);
        } else if (kyc.kycStatus === "SUBMITTED") {
          router.replace("/driver/onboarding/pending");
        } else {
          router.replace("/driver/onboarding/welcome");
        }
      } catch {
        router.replace("/driver/onboarding/welcome");
      }
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ERR_REQUEST_CANCELED"
      ) {
        return;
      }

      Alert.alert(
        "Sign in failed",
        error instanceof Error ? error.message : "Could not sign in with Apple.",
      );
    } finally {
      setLoadingProvider(null);
    }
  }

  async function handleGoogleSignIn() {
    try {
      setLoadingProvider("google");

      const GoogleSignin = await loadGoogleSignin();
      if (!GoogleSignin) return;

      const webClientId = getGoogleWebClientId();
      if (!webClientId) return;

      GoogleSignin.configure({
        iosClientId: getGoogleIosClientId(),
        webClientId,
      });

      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();

      const idToken = response.data?.idToken;
      if (!idToken) {
        Alert.alert("Error", "Google did not return an ID token.");
        return;
      }

      const result = await signInWithGoogle({ idToken });

      await storeLocalAccessToken(result.accessToken);
      await persistAuthenticatedRole("DRIVER");
      await refreshAuthState();

      // Check KYC status — skip onboarding if already approved
      try {
        const kyc = await getDriverKycStatus({ accessToken: result.accessToken });
        if (kyc.kycStatus === "APPROVED") {
          router.replace("/driver/(tabs)/home" as any);
        } else if (kyc.kycStatus === "SUBMITTED") {
          router.replace("/driver/onboarding/pending");
        } else {
          router.replace("/driver/onboarding/welcome");
        }
      } catch {
        router.replace("/driver/onboarding/welcome");
      }
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "SIGN_IN_CANCELLED"
      ) {
        return;
      }

      Alert.alert(
        "Sign in failed",
        error instanceof Error ? error.message : "Could not sign in with Google.",
      );
    } finally {
      setLoadingProvider(null);
    }
  }

  return (
    <AuthEntryScreen
      label="DRIVER"
      tagline="Earn on your schedule"
      loadingProvider={loadingProvider}
      onApple={handleAppleSignIn}
      onGoogle={handleGoogleSignIn}
      onEmailSignUp={() =>
        router.push({ pathname: "/account-auth", params: { mode: "signup" } })
      }
      onEmailSignIn={() =>
        router.push({ pathname: "/account-auth", params: { mode: "signin" } })
      }
    />
  );
}
