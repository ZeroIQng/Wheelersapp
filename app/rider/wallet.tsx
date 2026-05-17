import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Clipboard from "expo-clipboard";
import { usePrivy } from "@privy-io/expo";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import { AppCard } from "@/components/app-card";
import { AppScreen } from "@/components/app-screen";
import { AppText } from "@/components/app-text";
import { SectionHeader } from "@/components/SectionHeader";
import { WalletBalanceCard } from "@/components/WalletBalanceCard";
import { getAccessTokenWithRetry } from "@/lib/access-token";
import {
  createPouchOnramp,
  getPouchRampStatus,
  isBackendConfigured,
  type PouchPaymentInstruction,
  type PouchRampStatusPayload,
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

function readPouchStatus(status: PouchRampStatusPayload | null): string | null {
  return typeof status?.status === "string" && status.status.trim().length > 0
    ? status.status.toUpperCase()
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

async function waitForPouchSettlement(input: {
  accessToken: string;
  providerRef: string;
  attempts?: number;
  delayMs?: number;
}) {
  const attempts = input.attempts ?? 6;
  const delayMs = input.delayMs ?? 3000;

  let latestStatus = await getPouchRampStatus({
    accessToken: input.accessToken,
    providerRef: input.providerRef,
    type: "ONRAMP",
  });

  for (let attempt = 1; attempt < attempts; attempt += 1) {
    if (isPouchSessionSettled(readPouchStatus(latestStatus.status))) {
      return latestStatus;
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
    latestStatus = await getPouchRampStatus({
      accessToken: input.accessToken,
      providerRef: input.providerRef,
      type: "ONRAMP",
    });
  }

  return latestStatus;
}

function formatInstructionAmount(instruction: PouchPaymentInstruction | null): string | null {
  if (!instruction?.amountLocal || !instruction.localCurrency) {
    return null;
  }

  return `${instruction.localCurrency} ${instruction.amountLocal.toLocaleString("en-NG")}`;
}

function formatInstructionExpiry(instruction: PouchPaymentInstruction | null): string | null {
  if (!instruction?.expiresAt) {
    return null;
  }

  const parsed = new Date(instruction.expiresAt);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
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
  const [isPaymentWidgetVisible, setPaymentWidgetVisible] = useState(false);
  const [isLaunchingPouchDeposit, setLaunchingPouchDeposit] = useState(false);
  const [isRefreshingPouchStatus, setRefreshingPouchStatus] = useState(false);
  const [activePouchProviderRef, setActivePouchProviderRef] = useState<string | null>(null);
  const [activePaymentInstruction, setActivePaymentInstruction] =
    useState<PouchPaymentInstruction | null>(null);
  const [activePouchStatus, setActivePouchStatus] = useState<string | null>(null);
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

  const closePaymentWidget = () => {
    if (isRefreshingPouchStatus) {
      return;
    }

    setPaymentWidgetVisible(false);
  };

  const maybeContinueDeferredRide = () => {
    if (redirectReason !== "insufficient-funds") {
      return;
    }

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

  const handleCopyValue = async (label: string, value?: string | null) => {
    if (!value) {
      return;
    }

    await Clipboard.setStringAsync(value);
    setToastMessage(`${label} copied.`);
  };

  const handleRefreshDepositStatus = async () => {
    if (!activePouchProviderRef) {
      Alert.alert(
        "No active deposit",
        "Start a Pouch deposit first to refresh its status.",
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
        "Could not get an access token for the Pouch deposit status check.",
      );
      return;
    }

    setRefreshingPouchStatus(true);

    try {
      const latestStatus = await waitForPouchSettlement({
        accessToken,
        providerRef: activePouchProviderRef,
        attempts: 2,
        delayMs: 2000,
      });
      const status = readPouchStatus(latestStatus.status);
      setActivePouchStatus(status);

      if (isPouchSessionSettled(status)) {
        setToastMessage("Pouch deposit completed. Your wallet credit is being processed.");
        maybeContinueDeferredRide();
        return;
      }

      setToastMessage(`Pouch deposit status: ${formatPouchStatus(status)}.`);
    } catch (error) {
      Alert.alert(
        "Status refresh failed",
        error instanceof Error
          ? error.message
          : "Could not refresh the Pouch deposit status.",
      );
    } finally {
      setRefreshingPouchStatus(false);
    }
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
      const response = await createPouchOnramp({
        accessToken,
        amount: amountLocal,
      });

      const providerRef =
        typeof response.providerRef === "string" && response.providerRef.trim().length > 0
          ? response.providerRef
          : null;

      if (!providerRef) {
        throw new Error("Pouch did not return a provider reference.");
      }

      setActivePouchProviderRef(providerRef);
      setActivePaymentInstruction(response.paymentInstruction ?? null);
      setActivePouchStatus("PENDING");
      setDepositModalVisible(false);
      setPaymentWidgetVisible(true);
      setDepositAmount("");

      const instructionAmount = formatInstructionAmount(response.paymentInstruction ?? null);
      const instructionAccount = response.paymentInstruction?.accountNumber;

      setToastMessage(
        instructionAccount
          ? `Transfer ${instructionAmount ?? "the requested amount"} to ${instructionAccount}.`
          : "Pouch deposit created. Use the returned bank transfer instruction to complete payment.",
      );
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

  const displayedAccountName = activePouchProviderRef
    ? activePaymentInstruction?.accountName
    : walletOverview.accountDetails.accountName;
  const displayedAccountNumber = activePouchProviderRef
    ? activePaymentInstruction?.accountNumber
    : walletOverview.accountDetails.accountNumber;
  const displayedBankName = activePouchProviderRef
    ? activePaymentInstruction?.bankName
    : walletOverview.accountDetails.bankName;
  const displayedInstructionAmount = formatInstructionAmount(activePaymentInstruction);
  const displayedInstructionExpiry = formatInstructionExpiry(activePaymentInstruction);
  const displayedPouchStatus = formatPouchStatus(activePouchStatus);

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
          accountName={displayedAccountName}
          accountNumber={displayedAccountNumber}
          bankName={displayedBankName}
          onDeposit={openDepositModal}
          onWithdraw={handleWithdrawPress}
        />
        {activePouchProviderRef ? (
          <AppCard style={styles.activeDepositCard}>
            <View style={styles.activeDepositHeader}>
              <View style={styles.pageCopy}>
                <AppText variant="label">Deposit ready to pay</AppText>
                <AppText variant="bodySmall" color={theme.colors.muted}>
                  Bank transfer instructions are waiting for you.
                </AppText>
              </View>
              <View style={styles.statusPill}>
                <AppText variant="bodySmall">{displayedPouchStatus}</AppText>
              </View>
            </View>
            <View style={styles.widgetButtonRow}>
              <Pressable
                onPress={() => setPaymentWidgetVisible(true)}
                style={styles.primaryWidgetButton}
              >
                <MaterialIcons color={theme.colors.offWhite} name="account-balance" size={18} />
                <AppText variant="label" color={theme.colors.offWhite}>
                  Open payment widget
                </AppText>
              </Pressable>
              <Pressable
                disabled={isRefreshingPouchStatus}
                onPress={handleRefreshDepositStatus}
                style={styles.refreshChip}
              >
                <MaterialIcons
                  color={theme.colors.black}
                  name="sync"
                  size={16}
                />
                <AppText variant="bodySmall">
                  {isRefreshingPouchStatus ? "Checking" : "Refresh"}
                </AppText>
              </Pressable>
            </View>
          </AppCard>
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
                  Enter the amount you want to fund, then we will generate your bank transfer instruction.
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
                  title={isLaunchingPouchDeposit ? "Paying" : "Continue"}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={closePaymentWidget}
        transparent
        visible={isPaymentWidgetVisible}
      >
        <View style={styles.paymentWidgetBackdrop}>
          <View style={styles.paymentWidgetSheet}>
            <View style={styles.paymentWidgetHeader}>
              <View style={styles.pageCopy}>
                <AppText variant="h3">Complete Payment</AppText>
                <AppText variant="bodySmall" color={theme.colors.muted}>
                  Transfer the exact amount to the bank account below.
                </AppText>
              </View>
              <Pressable onPress={closePaymentWidget} style={styles.closeButton}>
                <MaterialIcons color={theme.colors.black} name="close" size={18} />
              </Pressable>
            </View>

            <View style={styles.widgetHero}>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                Amount to Pay
              </AppText>
              <AppText variant="display">{displayedInstructionAmount ?? "Pending"}</AppText>
              <View style={styles.widgetMetaRow}>
                <View style={styles.statusPill}>
                  <AppText variant="bodySmall">{displayedPouchStatus}</AppText>
                </View>
                {displayedInstructionExpiry ? (
                  <AppText variant="bodySmall" color={theme.colors.muted}>
                    Expires {displayedInstructionExpiry}
                  </AppText>
                ) : null}
              </View>
            </View>

            <AppCard backgroundColor={theme.colors.white} style={styles.paymentDetailsCard}>
              <InstructionRow
                label="Bank Name"
                value={activePaymentInstruction?.bankName ?? "Pending"}
              />
              <InstructionRow
                label="Account Name"
                value={activePaymentInstruction?.accountName ?? "Pending"}
              />
              <InstructionRow
                label="Account Number"
                value={activePaymentInstruction?.accountNumber ?? "Pending"}
                actionLabel="Copy"
                onActionPress={() =>
                  handleCopyValue("Account number", activePaymentInstruction?.accountNumber)
                }
              />
            </AppCard>

            <View style={styles.widgetButtonStack}>
              <AppButton
                disabled={isRefreshingPouchStatus}
                onPress={handleRefreshDepositStatus}
                title={isRefreshingPouchStatus ? "Checking payment" : "I have paid, refresh status"}
              />
              <AppButton
                onPress={closePaymentWidget}
                style={styles.cancelButton}
                title="Close"
                variant="ghost"
              />
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

function InstructionRow(props: {
  label: string;
  value: string;
  actionLabel?: string;
  onActionPress?: () => void;
}) {
  return (
    <View style={styles.instructionRow}>
      <View style={styles.pageCopy}>
        <AppText variant="bodySmall" color={theme.colors.muted}>
          {props.label}
        </AppText>
        <AppText variant={props.label === "Account Number" ? "monoLarge" : "bodyMedium"}>
          {props.value}
        </AppText>
      </View>
      {props.actionLabel && props.onActionPress ? (
        <Pressable onPress={props.onActionPress} style={styles.inlineCopyButton}>
          <MaterialIcons color={theme.colors.black} name="content-copy" size={14} />
          <AppText variant="bodySmall">{props.actionLabel}</AppText>
        </Pressable>
      ) : null}
    </View>
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
  activeDepositCard: {
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadows.card,
  },
  activeDepositHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.md,
  },
  statusPill: {
    alignSelf: "flex-start",
    borderWidth: theme.borders.regular,
    borderColor: "#F4B28D",
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.orangeLight,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  widgetButtonRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  primaryWidgetButton: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.black,
  },
  refreshChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.orangeLight,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  paymentWidgetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(13,13,13,0.48)",
    justifyContent: "flex-end",
  },
  paymentWidgetSheet: {
    borderTopLeftRadius: theme.radii.lg,
    borderTopRightRadius: theme.radii.lg,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.offWhite,
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  paymentWidgetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  widgetHero: {
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.orange,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.orangeLight,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
    ...theme.shadows.card,
  },
  widgetMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    flexWrap: "wrap",
  },
  paymentDetailsCard: {
    gap: theme.spacing.sm,
  },
  instructionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE0D4",
  },
  inlineCopyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  widgetButtonStack: {
    gap: theme.spacing.sm,
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
