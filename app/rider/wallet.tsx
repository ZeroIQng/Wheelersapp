import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { usePrivy } from "@privy-io/expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { openBrowserAsync, WebBrowserPresentationStyle } from "expo-web-browser";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppButton } from "@/components/app-button";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { SectionHeader } from "@/components/SectionHeader";
import { WalletBalanceCard } from "@/components/WalletBalanceCard";
import { getAccessTokenWithRetry } from "@/lib/access-token";
import {
  createPouchSession,
  getPouchSession,
  isBackendConfigured,
  type PouchGetSessionResponse,
  type PouchSession,
} from "@/lib/api";
import { walletOverview } from "@/data/mock";
import { theme } from "@/theme";

const walletPages = [
  {
    id: "transactions",
    icon: "receipt-long",
    title: "View transactions",
    subtitle: "See wallet inflow and ride charges.",
  },
  {
    id: "pay-online",
    icon: "language",
    title: "Pay online",
    subtitle: "Choose card or bank transfer checkout.",
  },
] as const;

const POUCH_SETTLED_STATUSES = new Set([
  "COMPLETED",
  "COMPLETE",
  "SUCCESS",
  "SUCCEEDED",
  "PAID",
  "SETTLED",
  "FUNDED",
]);

function parseNgnAmount(value: string): number | null {
  const digitsOnly = value.replace(/\D/g, "");
  if (!digitsOnly) {
    return null;
  }

  const amount = Number(digitsOnly);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickNestedString(record: Record<string, unknown>, path: string): string | null {
  const segments = path.split(".");
  let current: unknown = record;

  for (const segment of segments) {
    if (!isRecord(current)) {
      return null;
    }

    current = current[segment];
  }

  return typeof current === "string" && current.trim().length > 0 ? current : null;
}

function extractPouchHostedUrl(session: PouchSession): string | null {
  const candidatePaths = [
    "hostedUrl",
    "hostedURL",
    "checkoutUrl",
    "checkoutURL",
    "redirectUrl",
    "redirectURL",
    "paymentUrl",
    "paymentURL",
    "url",
    "widgetUrl",
    "widgetURL",
    "paymentInstruction.url",
    "paymentInstruction.checkoutUrl",
    "links.checkout",
    "links.hosted",
  ];

  for (const path of candidatePaths) {
    const value = pickNestedString(session, path);
    if (!value) {
      continue;
    }

    try {
      return new URL(value).toString();
    } catch {
      continue;
    }
  }

  return findUrlLikeValue(session);
}

function findUrlLikeValue(value: unknown): string | null {
  if (typeof value === "string") {
    try {
      return new URL(value).toString();
    } catch {
      return null;
    }
  }

  if (!isRecord(value)) {
    return null;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (!/(url|link|href|redirect)/i.test(key)) {
      continue;
    }

    const resolved = findUrlLikeValue(nestedValue);
    if (resolved) {
      return resolved;
    }
  }

  for (const nestedValue of Object.values(value)) {
    const resolved = findUrlLikeValue(nestedValue);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

function readPouchSessionStatus(session: PouchSession): string | null {
  return typeof session.status === "string" && session.status.trim().length > 0
    ? session.status.toUpperCase()
    : null;
}

function formatPouchStatus(status: string | null): string {
  if (!status) {
    return "pending";
  }

  return status.toLowerCase().replace(/_/g, " ");
}

function isPouchSessionSettled(status: string | null): boolean {
  return status != null && POUCH_SETTLED_STATUSES.has(status.toUpperCase());
}

async function waitForPouchSessionSettlement(input: {
  accessToken: string;
  sessionId: string;
  attempts?: number;
  delayMs?: number;
}): Promise<PouchGetSessionResponse> {
  const attempts = input.attempts ?? 6;
  const delayMs = input.delayMs ?? 2500;

  let latestSession = await getPouchSession({
    accessToken: input.accessToken,
    sessionId: input.sessionId,
  });

  for (let attempt = 1; attempt < attempts; attempt += 1) {
    if (isPouchSessionSettled(readPouchSessionStatus(latestSession.session))) {
      return latestSession;
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
    latestSession = await getPouchSession({
      accessToken: input.accessToken,
      sessionId: input.sessionId,
    });
  }

  return latestSession;
}

export default function WalletScreen() {
  const router = useRouter();
  const { getAccessToken, isReady } = usePrivy();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    depositAmount?: string | string[];
    redirectReason?: string | string[];
    rideName?: string | string[];
    itinerary?: string | string[];
  }>();
  const [depositAmount, setDepositAmount] = useState("");
  const [isDepositModalVisible, setDepositModalVisible] = useState(false);
  const [isLaunchingPouchDeposit, setLaunchingPouchDeposit] = useState(false);
  const [activePouchSessionId, setActivePouchSessionId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const handledRedirectRef = useRef<string | null>(null);
  const redirectReason = Array.isArray(params.redirectReason)
    ? params.redirectReason[0]
    : params.redirectReason;
  const itineraryParam = Array.isArray(params.itinerary)
    ? params.itinerary[0]
    : params.itinerary;

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();

    const timeout = setTimeout(() => {
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setToastMessage(null);
        }
      });
    }, 2800);

    return () => clearTimeout(timeout);
  }, [toastMessage, toastOpacity]);

  useEffect(() => {
    const rawDepositAmount = Array.isArray(params.depositAmount)
      ? params.depositAmount[0]
      : params.depositAmount;
    const rideName = Array.isArray(params.rideName)
      ? params.rideName[0]
      : params.rideName;

    if (
      redirectReason !== "insufficient-funds" ||
      !rawDepositAmount ||
      handledRedirectRef.current === rawDepositAmount
    ) {
      return;
    }

    const numericAmount = Number(rawDepositAmount.replace(/\D/g, ""));

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return;
    }

    const formattedAmount = numericAmount.toLocaleString("en-NG");
    handledRedirectRef.current = rawDepositAmount;
    toastOpacity.setValue(0);
    setDepositAmount(formattedAmount);
    setDepositModalVisible(true);
    setToastMessage(
      `Insufficient funds${rideName ? ` for ${rideName}` : ""}. Add NGN ${formattedAmount} to continue.`,
    );
  }, [params.depositAmount, params.redirectReason, params.rideName, redirectReason, toastOpacity]);

  const handleDepositAmountChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, "");

    if (!digitsOnly) {
      setDepositAmount("");
      return;
    }

    setDepositAmount(Number(digitsOnly).toLocaleString("en-NG"));
  };

  const openDepositModal = () => {
    setDepositModalVisible(true);
  };

  const closeDepositModal = () => {
    if (isLaunchingPouchDeposit) {
      return;
    }
    setDepositModalVisible(false);
  };

  const handleWithdrawPress = () => {
    Alert.alert(
      "Withdrawals pending",
      "Withdraw will stay pending for now. Deposit flow comes first.",
    );
  };

  const handleYieldPress = () => {
    Alert.alert(
      "Earn yield",
      "Yield deposits will open from this button soon.",
    );
  };

  const handleDepositContinue = async () => {
    const amountLocal = parseNgnAmount(depositAmount);

    if (!amountLocal) {
      Alert.alert(
        "Amount required",
        "Enter the amount you want to deposit in Naira.",
      );
      return;
    }

    if (!isBackendConfigured()) {
      Alert.alert(
        "Backend unavailable",
        "Set EXPO_PUBLIC_API_BASE_URL before starting a Pouch deposit.",
      );
      return;
    }

    if (!isReady) {
      Alert.alert(
        "Account still loading",
        "Wait a moment for your session to finish loading, then try again.",
      );
      return;
    }

    const accessToken = await getAccessTokenWithRetry(getAccessToken);
    if (!accessToken) {
      Alert.alert(
        "Authentication required",
        "Could not get an access token for the Pouch deposit.",
      );
      return;
    }

    setLaunchingPouchDeposit(true);

    try {
      const response = await createPouchSession({
        accessToken,
        type: "ONRAMP",
        amountLocal,
        countryCode: "NG",
        currency: "NGN",
        cryptoCurrency: "USDC",
        cryptoNetwork: "XLM",
      });

      const sessionId =
        typeof response.session.id === "string" && response.session.id.trim().length > 0
          ? response.session.id
          : null;

      if (!sessionId) {
        throw new Error("Pouch did not return a session ID.");
      }

      setActivePouchSessionId(sessionId);
      setDepositModalVisible(false);

      const hostedUrl = extractPouchHostedUrl(response.session);
      if (!hostedUrl) {
        setToastMessage(
          "Pouch session created, but no hosted checkout URL was returned by the provider.",
        );
        return;
      }

      await openBrowserAsync(hostedUrl, {
        presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
      });

      const refreshedSession = await waitForPouchSessionSettlement({
        accessToken,
        sessionId,
      });
      const status = readPouchSessionStatus(refreshedSession.session);

      if (isPouchSessionSettled(status)) {
        setToastMessage("Pouch deposit completed. Your wallet credit is being processed.");

        if (redirectReason === "insufficient-funds") {
          router.replace(
            itineraryParam
              ? {
                  pathname: "/matching",
                  params: {
                    itinerary: itineraryParam,
                  },
                }
              : "/matching",
          );
        }

        return;
      }

      setToastMessage(`Pouch deposit status: ${formatPouchStatus(status)}.`);
    } catch (error) {
      Alert.alert(
        "Deposit failed",
        error instanceof Error ? error.message : "Could not start the Pouch deposit.",
      );
    } finally {
      setLaunchingPouchDeposit(false);
    }
  };

  const handleWalletPagePress = (pageId: string) => {
    if (pageId === "transactions") {
      Alert.alert(
        "Transactions",
        "Transaction history will open from this shortcut soon.",
      );
      return;
    }

    if (pageId === "pay-online") {
      setDepositModalVisible(true);
      return;
    }

    Alert.alert("Withdrawals pending", "Withdraw pages are not active yet.");
  };

  return (
    <>
      <AppScreen
        backgroundColor={theme.colors.offWhite}
        scroll
        contentStyle={styles.container}
      >
        <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />
        <SectionHeader
          actionLabel="Rider home"
          onActionPress={() => router.replace("/rider")}
          subtitle="Fund your wallet in Naira through Pouch onramp."
          title="Wallet"
          titleVariant="h1"
        />

        <WalletBalanceCard
          balance={walletOverview.balance}
          fiatApprox={walletOverview.fiatApprox}
          onDeposit={openDepositModal}
          onWithdraw={handleWithdrawPress}
        />
        {activePouchSessionId ? (
          <AppText variant="bodySmall" color={theme.colors.muted}>
            Active Pouch deposit: {activePouchSessionId}
          </AppText>
        ) : null}

        <Pressable onPress={handleYieldPress} style={styles.yieldCard}>
          <AppText variant="h3" color={theme.colors.offWhite}>
            Earn Yield
          </AppText>
        </Pressable>

        <SectionHeader
          subtitle="Clean wallet pages instead of the old deposit form block."
          title="Wallet pages"
          titleVariant="h3"
        />
        <View style={styles.walletPagesList}>
          {walletPages.map((page) => (
            <Pressable
              key={page.id}
              onPress={() => handleWalletPagePress(page.id)}
              style={styles.pageCard}
            >
              <View style={styles.pageIconWrap}>
                <MaterialIcons
                  color={theme.colors.black}
                  name={page.icon}
                  size={18}
                />
              </View>
              <View style={styles.pageCopy}>
                <AppText variant="label">{page.title}</AppText>
                <AppText variant="bodySmall" color={theme.colors.muted}>
                  {page.subtitle}
                </AppText>
              </View>
              <MaterialIcons
                color={theme.colors.orange}
                name="arrow-forward"
                size={18}
              />
            </Pressable>
          ))}
        </View>
      </AppScreen>

      <Modal
        animationType="fade"
        onRequestClose={closeDepositModal}
        transparent
        visible={isDepositModalVisible}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <AppText variant="h3">Deposit in Naira</AppText>
                <AppText variant="bodySmall" color={theme.colors.muted}>
                  Enter the amount you want to fund, then continue into Pouch checkout.
                </AppText>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                Amount in NGN
              </AppText>
              <TextInput
                keyboardType="number-pad"
                onChangeText={handleDepositAmountChange}
                placeholder="20,000"
                placeholderTextColor="#B5ACA4"
                style={styles.input}
                value={depositAmount}
              />
            </View>

            <View style={styles.modalButtonRow}>
              <View style={styles.modalButtonSlot}>
                <AppButton
                  onPress={closeDepositModal}
                  style={styles.cancelButton}
                  title="Cancel"
                  variant="ghost"
                />
              </View>
              <View style={styles.modalButtonSlot}>
                <AppButton
                  disabled={isLaunchingPouchDeposit}
                  onPress={handleDepositContinue}
                  title={isLaunchingPouchDeposit ? "Opening" : "Continue"}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {toastMessage ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            {
              top: insets.top + theme.spacing.sm,
              opacity: toastOpacity,
              transform: [
                {
                  translateY: toastOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-12, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <MaterialIcons
            color={theme.colors.offWhite}
            name="info-outline"
            size={18}
          />
          <AppText
            variant="bodySmall"
            color={theme.colors.offWhite}
            style={styles.toastText}
          >
            {toastMessage}
          </AppText>
        </Animated.View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  yieldCard: {
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.orange,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.orange,
    padding: theme.spacing.md,
    minHeight: 72,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.card,
  },
  walletPagesList: {
    gap: theme.spacing.sm,
  },
  pageCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    ...theme.shadows.card,
  },
  pageIconWrap: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.orangeLight,
    borderWidth: theme.borders.regular,
    borderColor: "#F0B48D",
  },
  pageCopy: {
    flex: 1,
    gap: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(13,13,13,0.44)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.layout.screenPadding,
  },
  modalCard: {
    width: "100%",
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.offWhite,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadows.card,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: theme.spacing.md,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: theme.radii.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.white,
  },
  fieldGroup: {
    gap: theme.spacing.xs,
  },
  input: {
    minHeight: 50,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.md,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    color: theme.colors.black,
  },
  modalButtonRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  modalButtonSlot: {
    flex: 1,
  },
  cancelButton: {
    backgroundColor: theme.colors.white,
    shadowOpacity: 0,
    elevation: 0,
  },
  toast: {
    position: "absolute",
    left: theme.layout.screenPadding,
    right: theme.layout.screenPadding,
    zIndex: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.black,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    ...theme.shadows.card,
  },
  toastText: {
    flex: 1,
  },
});
