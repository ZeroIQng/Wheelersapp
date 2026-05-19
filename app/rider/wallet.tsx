import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { usePrivy } from "@privy-io/expo";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
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
  createWalletWithdrawal,
  createPouchOnramp,
  getWithdrawalBankNetworks,
  getPouchRampStatus,
  isBackendConfigured,
  type PouchPaymentInstruction,
  type PouchRampStatusPayload,
  type WithdrawalBankNetwork,
  verifyWithdrawalBankAccount,
} from "@/lib/api";
import { useWalletOverview } from "@/lib/wallet-overview";
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

function formatInstructionAmount(
  instruction: PouchPaymentInstruction | null,
): string | null {
  if (!instruction?.amountLocal || !instruction.localCurrency) {
    return null;
  }

  return `${instruction.localCurrency} ${instruction.amountLocal.toLocaleString("en-NG")}`;
}

function formatInstructionExpiry(
  instruction: PouchPaymentInstruction | null,
): string | null {
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

function getInstructionTimeLeftMs(
  instruction: PouchPaymentInstruction | null,
): number | null {
  if (!instruction?.expiresAt) {
    return null;
  }

  const expiry = new Date(instruction.expiresAt).getTime();
  if (Number.isNaN(expiry)) {
    return null;
  }

  return Math.max(0, expiry - Date.now());
}

function formatTimeLeft(ms: number | null): string | null {
  if (ms == null) {
    return null;
  }

  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatWalletCurrencyAmount(currency: string, amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const hasDecimals = Math.abs(rounded % 1) > 0;

  return `${currency} ${rounded.toLocaleString("en-NG", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

export default function WalletScreen() {
  const router = useRouter();
  const { getAccessToken, isReady } = usePrivy();
  const insets = useSafeAreaInsets();
  const {
    overview,
    refresh: refreshWalletOverview,
  } = useWalletOverview();
  const params = useLocalSearchParams<{
    depositAmount?: string | string[];
    redirectReason?: string | string[];
    rideName?: string | string[];
    itinerary?: string | string[];
  }>();
  const [depositAmount, setDepositAmount] = useState("");
  const [isDepositModalVisible, setDepositModalVisible] = useState(false);
  const [isWithdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [isWithdrawConfirmVisible, setWithdrawConfirmVisible] = useState(false);
  const [isBankPickerVisible, setBankPickerVisible] = useState(false);
  const [isPaymentWidgetVisible, setPaymentWidgetVisible] = useState(false);
  const [isLaunchingPouchDeposit, setLaunchingPouchDeposit] = useState(false);
  const [isCreatingWithdrawal, setCreatingWithdrawal] = useState(false);
  const [isLoadingBankNetworks, setLoadingBankNetworks] = useState(false);
  const [isVerifyingBankAccount, setVerifyingBankAccount] = useState(false);
  const [isRefreshingPouchStatus, setRefreshingPouchStatus] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [bankSearchQuery, setBankSearchQuery] = useState("");
  const [withdrawBankNetworks, setWithdrawBankNetworks] = useState<
    WithdrawalBankNetwork[]
  >([]);
  const [selectedWithdrawBank, setSelectedWithdrawBank] =
    useState<WithdrawalBankNetwork | null>(null);
  const [withdrawAccountNumber, setWithdrawAccountNumber] = useState("");
  const [verifiedWithdrawAccount, setVerifiedWithdrawAccount] = useState<{
    accountNumber: string;
    accountName: string;
    bankName: string;
    networkId: string;
  } | null>(null);
  const [activePouchProviderRef, setActivePouchProviderRef] = useState<
    string | null
  >(null);
  const [activePaymentInstruction, setActivePaymentInstruction] =
    useState<PouchPaymentInstruction | null>(null);
  const [activePouchStatus, setActivePouchStatus] = useState<string | null>(
    null,
  );
  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const handledRedirectRef = useRef<string | null>(null);
  const lastBankLookupKeyRef = useRef<string | null>(null);
  const hasPrefetchedBanksRef = useRef(false);
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

  const showToast = (message: string) => {
    toastOpacity.setValue(0);
    setToastMessage(message);
  };

  const resetPaymentWidget = () => {
    setPaymentWidgetVisible(false);
    setActivePouchProviderRef(null);
    setActivePaymentInstruction(null);
    setActivePouchStatus(null);
    setTimeLeftMs(null);
  };

  useEffect(() => {
    if (!isPaymentWidgetVisible || !activePaymentInstruction?.expiresAt) {
      setTimeLeftMs(null);
      return;
    }

    const update = () => {
      setTimeLeftMs(getInstructionTimeLeftMs(activePaymentInstruction));
    };

    update();
    const interval = setInterval(update, 1000);

    return () => clearInterval(interval);
  }, [activePaymentInstruction, isPaymentWidgetVisible]);

  useEffect(() => {
    if (!isPaymentWidgetVisible || timeLeftMs == null || timeLeftMs > 0) {
      return;
    }

    resetPaymentWidget();
    showToast(
      "Payment window expired. Start a new deposit for a fresh account number.",
    );
  }, [isPaymentWidgetVisible, timeLeftMs]);

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
    showToast(
      `Insufficient funds${rideName ? ` for ${rideName}` : ""}. Add NGN ${formattedAmount} to continue.`,
    );
  }, [
    params.depositAmount,
    params.redirectReason,
    params.rideName,
    redirectReason,
    toastOpacity,
  ]);

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

  const handleWithdrawAmountChange = (value: string) => {
    setVerifiedWithdrawAccount(null);
    const digitsOnly = value.replace(/\D/g, "");

    if (!digitsOnly) {
      setWithdrawAmount("");
      return;
    }

    setWithdrawAmount(Number(digitsOnly).toLocaleString("en-NG"));
  };

  const openWithdrawModal = () => {
    setWithdrawConfirmVisible(false);
    setBankPickerVisible(false);
    setWithdrawModalVisible(true);
    void loadWithdrawalBankNetworks("");
  };

  const closeWithdrawModal = () => {
    if (isCreatingWithdrawal || isVerifyingBankAccount) {
      return;
    }

    setWithdrawModalVisible(false);
    setBankPickerVisible(false);
  };

  const closeWithdrawConfirmModal = () => {
    if (isCreatingWithdrawal) {
      return;
    }

    setWithdrawConfirmVisible(false);
  };

  const closeBankPickerModal = () => {
    setBankPickerVisible(false);
    setWithdrawModalVisible(true);
  };

  const resetWithdrawalFlow = () => {
    setWithdrawModalVisible(false);
    setWithdrawConfirmVisible(false);
    setBankPickerVisible(false);
    setWithdrawAmount("");
    setWithdrawAccountNumber("");
    setSelectedWithdrawBank(null);
    setVerifiedWithdrawAccount(null);
    setBankSearchQuery("");
  };

  const closePaymentWidget = () => {
    if (isRefreshingPouchStatus) {
      return;
    }

    resetPaymentWidget();
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
    openWithdrawModal();
  };

  const availableWithdrawalBalanceNgn = overview?.balanceNgn ?? 0;

  const loadWithdrawalBankNetworks = async (query?: string) => {
    const normalizedQuery = query?.trim().toLowerCase() ?? "";
    const lookupKey = `NG:${normalizedQuery}`;

    if (!isBackendConfigured()) {
      return;
    }

    if (!isReady) {
      return;
    }

    if (isLoadingBankNetworks || lastBankLookupKeyRef.current === lookupKey) {
      return;
    }

    const accessToken = await getAccessTokenWithRetry(getAccessToken);
    if (!accessToken) {
      return;
    }

    lastBankLookupKeyRef.current = lookupKey;
    setLoadingBankNetworks(true);

    try {
      const response = await getWithdrawalBankNetworks({
        accessToken,
        country: "NG",
        query: normalizedQuery || undefined,
        limit: normalizedQuery ? 100 : 40,
      });
      setWithdrawBankNetworks(response.items);
    } catch (error) {
      lastBankLookupKeyRef.current = null;
      showToast(
        error instanceof Error
          ? error.message
          : "Could not load the supported withdrawal banks.",
      );
    } finally {
      setLoadingBankNetworks(false);
    }
  };

  useEffect(() => {
    if (!isReady || !isBankPickerVisible) {
      return;
    }

    const timeout = setTimeout(() => {
      void loadWithdrawalBankNetworks(bankSearchQuery);
    }, 90);

    return () => clearTimeout(timeout);
  }, [
    bankSearchQuery,
    isBankPickerVisible,
    isReady,
  ]);

  useEffect(() => {
    if (!isReady || !isBackendConfigured() || hasPrefetchedBanksRef.current) {
      return;
    }

    hasPrefetchedBanksRef.current = true;
    void loadWithdrawalBankNetworks("");
  }, [isReady]);

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
      showToast("Start a Pouch deposit first to refresh its status.");
      return;
    }

    if (!isReady) {
      showToast("Wait a moment for your account to finish loading.");
      return;
    }

    const accessToken = await getAccessTokenWithRetry(getAccessToken);
    if (!accessToken) {
      showToast("Could not verify your session right now.");
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
        await refreshWalletOverview();
        resetPaymentWidget();
        showToast(
          "Pouch deposit completed. Your wallet credit is being processed.",
        );
        maybeContinueDeferredRide();
        return;
      }

      showToast(`Pouch deposit status: ${formatPouchStatus(status)}.`);
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
      showToast("Backend unavailable right now.");
      return;
    }

    if (!isReady) {
      showToast("Wait a moment for your account to finish loading.");
      return;
    }

    const accessToken = await getAccessTokenWithRetry(getAccessToken);
    if (!accessToken) {
      showToast("Could not verify your session right now.");
      return;
    }

    setLaunchingPouchDeposit(true);

    try {
      const response = await createPouchOnramp({
        accessToken,
        amountLocal,
      });

      const providerRef =
        typeof response.providerRef === "string" &&
        response.providerRef.trim().length > 0
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

      const instructionAmount = formatInstructionAmount(
        response.paymentInstruction ?? null,
      );
      const instructionAccount = response.paymentInstruction?.accountNumber;

      showToast(
        instructionAccount
          ? `Transfer ${instructionAmount ?? "the requested amount"} to ${instructionAccount}.`
          : "Pouch deposit created. Use the returned bank transfer instruction to complete payment.",
      );
    } catch (error) {
      Alert.alert(
        "Deposit failed",
        error instanceof Error
          ? error.message
          : "Could not start the Pouch deposit.",
      );
    } finally {
      setLaunchingPouchDeposit(false);
    }
  };

  const handleWithdrawContinue = async () => {
    const amountNgn = parseNgnAmount(withdrawAmount);
    const bankAccountNumber = withdrawAccountNumber.replace(/\D/g, "");
    const bankNetworkId = selectedWithdrawBank?.id ?? "";

    if (!amountNgn) {
      Alert.alert(
        "Amount required",
        "Enter the amount you want to withdraw in Naira.",
      );
      return;
    }

    if (amountNgn > availableWithdrawalBalanceNgn) {
      Alert.alert(
        "Insufficient balance",
        `You have insufficient balance for this withdrawal. Available balance is NGN ${Math.round(
          availableWithdrawalBalanceNgn,
        ).toLocaleString("en-NG")}.`,
      );
      return;
    }

    if (!bankNetworkId || !bankAccountNumber) {
      Alert.alert(
        "Bank details required",
        "Choose a bank and enter your account number to continue.",
      );
      return;
    }

    if (bankAccountNumber.length < 10) {
      Alert.alert(
        "Account number required",
        "Enter a valid account number before continuing.",
      );
      return;
    }

    if (!isBackendConfigured()) {
      showToast("Backend unavailable right now.");
      return;
    }

    if (!isReady) {
      showToast("Wait a moment for your account to finish loading.");
      return;
    }

    const accessToken = await getAccessTokenWithRetry(getAccessToken);
    if (!accessToken) {
      showToast("Could not verify your session right now.");
      return;
    }

    setVerifyingBankAccount(true);

    try {
      const response = await verifyWithdrawalBankAccount({
        accessToken,
        accountNumber: bankAccountNumber,
        networkId: bankNetworkId,
      });

      if (!response.bankAccount.accountName || !response.bankAccount.bankName) {
        throw new Error("Pouch could not verify the bank account name.");
      }

      setVerifiedWithdrawAccount({
        accountNumber: response.bankAccount.accountNumber,
        accountName: response.bankAccount.accountName,
        bankName: response.bankAccount.bankName,
        networkId: response.bankAccount.networkId,
      });
      setWithdrawModalVisible(false);
      setWithdrawConfirmVisible(true);
    } catch (error) {
      Alert.alert(
        "Verification failed",
        error instanceof Error
          ? error.message
          : "Could not verify the bank account.",
      );
    } finally {
      setVerifyingBankAccount(false);
    }
  };

  const handleConfirmWithdrawal = async () => {
    const amountNgn = parseNgnAmount(withdrawAmount);

    if (!amountNgn || !verifiedWithdrawAccount) {
      Alert.alert(
        "Withdrawal details missing",
        "Verify the bank account again before proceeding.",
      );
      return;
    }

    if (amountNgn > availableWithdrawalBalanceNgn) {
      Alert.alert(
        "Insufficient balance",
        `You have insufficient balance for this withdrawal. Available balance is NGN ${Math.round(
          availableWithdrawalBalanceNgn,
        ).toLocaleString("en-NG")}.`,
      );
      return;
    }

    if (!isBackendConfigured()) {
      showToast("Backend unavailable right now.");
      return;
    }

    if (!isReady) {
      showToast("Wait a moment for your account to finish loading.");
      return;
    }

    const accessToken = await getAccessTokenWithRetry(getAccessToken);
    if (!accessToken) {
      showToast("Could not verify your session right now.");
      return;
    }

    setCreatingWithdrawal(true);

    try {
      const response = await createWalletWithdrawal({
        accessToken,
        amountNgn,
        bankAccount: {
          accountNumber: verifiedWithdrawAccount.accountNumber,
          accountName: verifiedWithdrawAccount.accountName,
          networkId: verifiedWithdrawAccount.networkId,
        },
      });

      await refreshWalletOverview();
      resetWithdrawalFlow();

      const payoutAmount =
        response.withdrawal?.quotedAmountNgn ?? response.withdrawal?.requestedAmountNgn;

      showToast(
        payoutAmount
          ? `Withdrawal request created for NGN ${payoutAmount.toLocaleString("en-NG")}.`
          : "Withdrawal request created and is now processing.",
      );
    } catch (error) {
      Alert.alert(
        "Withdrawal failed",
        error instanceof Error
          ? error.message
          : "Could not create the wallet withdrawal.",
      );
    } finally {
      setCreatingWithdrawal(false);
    }
  };

  const handleWalletPagePress = (pageId: string) => {
    if (pageId === "transactions") {
      router.push("/rider/transactions");
      return;
    }

    if (pageId === "pay-online") {
      setDepositModalVisible(true);
      return;
    }

    Alert.alert("Withdrawals pending", "Withdraw pages are not active yet.");
  };

  const displayedInstructionAmount = formatInstructionAmount(
    activePaymentInstruction,
  );
  const displayedInstructionExpiry = formatInstructionExpiry(
    activePaymentInstruction,
  );
  const displayedPouchStatus = formatPouchStatus(activePouchStatus);
  const displayedTimeLeft = formatTimeLeft(timeLeftMs);
  const displayCurrency = overview?.displayCurrency ?? "NGN";
  const displayedWalletBalance = formatWalletCurrencyAmount(
    displayCurrency,
    overview?.balanceNgn ?? 0,
  );
  const filteredWithdrawalBanks = withdrawBankNetworks.filter((bank) => {
    const query = bankSearchQuery.trim().toLowerCase();
    if (!query) {
      return true;
    }

    return (
      bank.name.toLowerCase().includes(query) ||
      (bank.code?.toLowerCase().includes(query) ?? false)
    );
  });
  const selectedWithdrawBankLabel = selectedWithdrawBank
    ? selectedWithdrawBank.name
    : "Select bank";
  const displayedWithdrawAmount = parseNgnAmount(withdrawAmount);

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
          // subtitle="Fund your wallet in Naira through Pouch onramp."
          title="Wallet"
          titleVariant="h1"
        />

        <WalletBalanceCard
          balance={displayedWalletBalance}
          onDeposit={openDepositModal}
          onWithdraw={handleWithdrawPress}
        />

        <Pressable onPress={handleYieldPress} style={styles.yieldCard}>
          <AppText variant="h3" color={theme.colors.offWhite}>
            Earn Yield
          </AppText>
        </Pressable>

        <SectionHeader
          // subtitle="Clean wallet pages instead of the old deposit form block."
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
                  Enter the amount you want to fund, then we will generate your
                  bank transfer instruction.
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
                  title="Continue"
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={closeWithdrawModal}
        transparent
        visible={isWithdrawModalVisible}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <AppText variant="h3">Withdraw in Naira</AppText>
                <AppText variant="bodySmall" color={theme.colors.muted}>
                  Enter your bank details and the amount you want paid out.
                </AppText>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                Amount in NGN
              </AppText>
              <TextInput
                keyboardType="number-pad"
                onChangeText={handleWithdrawAmountChange}
                placeholder="5,000"
                placeholderTextColor="#B5ACA4"
                style={styles.input}
                value={withdrawAmount}
              />
            </View>

            <View style={styles.fieldGroup}>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                Bank
              </AppText>
              <Pressable
                onPress={() => {
                  setWithdrawModalVisible(false);
                  setBankPickerVisible(true);
                  void loadWithdrawalBankNetworks(bankSearchQuery);
                }}
                style={styles.selectorInput}
              >
                <AppText
                  variant="bodyMedium"
                  color={
                    selectedWithdrawBank
                      ? theme.colors.black
                      : theme.colors.muted
                  }
                >
                  {selectedWithdrawBankLabel}
                </AppText>
                <MaterialIcons
                  color={theme.colors.black}
                  name="keyboard-arrow-down"
                  size={20}
                />
              </Pressable>
            </View>

            <View style={styles.fieldGroup}>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                Account number
              </AppText>
              <TextInput
                keyboardType="number-pad"
                onChangeText={(value) => {
                  setVerifiedWithdrawAccount(null);
                  setWithdrawAccountNumber(value.replace(/\D/g, ""));
                }}
                placeholder="0123456789"
                placeholderTextColor="#B5ACA4"
                style={styles.input}
                value={withdrawAccountNumber}
              />
            </View>

            <View style={styles.modalButtonRow}>
              <View style={styles.modalButtonSlot}>
                <AppButton
                  onPress={closeWithdrawModal}
                  style={styles.cancelButton}
                  title="Cancel"
                  variant="ghost"
                />
              </View>
              <View style={styles.modalButtonSlot}>
                <AppButton
                  disabled={isVerifyingBankAccount}
                  onPress={handleWithdrawContinue}
                  title="Continue"
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={closeBankPickerModal}
        transparent
        visible={isBankPickerVisible}
      >
        <View style={styles.paymentWidgetBackdrop}>
          <View style={styles.bankPickerSheet}>
            <View style={styles.paymentWidgetHeader}>
              <View style={styles.pageCopy}>
                <AppText variant="h3">Choose bank</AppText>
                <AppText variant="bodySmall" color={theme.colors.muted}>
                  Choose from the list or search for your bank.
                </AppText>
              </View>
              <Pressable
                onPress={closeBankPickerModal}
                style={styles.closeButton}
              >
                <MaterialIcons
                  color={theme.colors.black}
                  name="close"
                  size={18}
                />
              </Pressable>
            </View>

            <TextInput
              autoCapitalize="words"
              onChangeText={setBankSearchQuery}
              placeholder="Search bank"
              placeholderTextColor="#B5ACA4"
              style={styles.input}
              value={bankSearchQuery}
            />

            <ScrollView
              contentContainerStyle={styles.bankResultsList}
              showsVerticalScrollIndicator={false}
            >
              {filteredWithdrawalBanks.map((bank) => (
                <Pressable
                  key={bank.id}
                  onPress={() => {
                    setSelectedWithdrawBank(bank);
                    setVerifiedWithdrawAccount(null);
                    setBankPickerVisible(false);
                    setWithdrawModalVisible(true);
                  }}
                  style={styles.bankResultCard}
                >
                  <View style={styles.pageCopy}>
                    <AppText variant="label">{bank.name}</AppText>
                    {bank.code ? (
                      <AppText variant="bodySmall" color={theme.colors.muted}>
                        {bank.code}
                      </AppText>
                    ) : null}
                  </View>
                  <MaterialIcons
                    color={theme.colors.orange}
                    name="north-east"
                    size={16}
                  />
                </Pressable>
              ))}
              {!filteredWithdrawalBanks.length && !isLoadingBankNetworks ? (
                <AppText variant="bodySmall" color={theme.colors.muted}>
                  No banks matched your search.
                </AppText>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={closeWithdrawConfirmModal}
        transparent
        visible={isWithdrawConfirmVisible}
      >
        <View style={styles.paymentWidgetBackdrop}>
          <View style={styles.paymentWidgetSheet}>
            <View style={styles.paymentWidgetHeader}>
              <View style={styles.pageCopy}>
                <AppText variant="h3">Confirm Withdrawal</AppText>
                <AppText variant="bodySmall" color={theme.colors.muted}>
                  Review the verified account details before you proceed.
                </AppText>
              </View>
              <Pressable
                onPress={closeWithdrawConfirmModal}
                style={styles.closeButton}
              >
                <MaterialIcons
                  color={theme.colors.black}
                  name="close"
                  size={18}
                />
              </Pressable>
            </View>

            <View style={styles.widgetHero}>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                Withdrawal amount
              </AppText>
              <AppText variant="display">
                {displayedWithdrawAmount
                  ? `NGN ${displayedWithdrawAmount.toLocaleString("en-NG")}`
                  : "Pending"}
              </AppText>
            </View>

            <AppCard
              backgroundColor={theme.colors.white}
              style={styles.paymentDetailsCard}
            >
              <InstructionRow
                label="Bank Name"
                value={verifiedWithdrawAccount?.bankName ?? "Pending"}
              />
              <InstructionRow
                label="Account Number"
                value={verifiedWithdrawAccount?.accountNumber ?? "Pending"}
              />
              <InstructionRow
                label="Account Name"
                value={verifiedWithdrawAccount?.accountName ?? "Pending"}
              />
            </AppCard>

            <View style={styles.widgetButtonStack}>
              <AppButton
                disabled={isCreatingWithdrawal}
                onPress={handleConfirmWithdrawal}
                title="Proceed"
              />
              <AppButton
                onPress={() => {
                  setWithdrawConfirmVisible(false);
                  setWithdrawModalVisible(true);
                }}
                style={styles.cancelButton}
                title="Back"
                variant="ghost"
              />
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
              <Pressable
                onPress={closePaymentWidget}
                style={styles.closeButton}
              >
                <MaterialIcons
                  color={theme.colors.black}
                  name="close"
                  size={18}
                />
              </Pressable>
            </View>

            <View style={styles.widgetHero}>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                Amount to Pay
              </AppText>
              <AppText variant="display">
                {displayedInstructionAmount ?? "Pending"}
              </AppText>
              <View style={styles.widgetMetaRow}>
                <View style={styles.statusPill}>
                  <AppText variant="bodySmall">{displayedPouchStatus}</AppText>
                </View>
                {displayedTimeLeft ? (
                  <View style={styles.timerPill}>
                    <MaterialIcons
                      color={theme.colors.black}
                      name="schedule"
                      size={14}
                    />
                    <AppText variant="bodySmall">
                      Time left {displayedTimeLeft}
                    </AppText>
                  </View>
                ) : null}
              </View>
              {displayedInstructionExpiry ? (
                <AppText variant="bodySmall" color={theme.colors.muted}>
                  Expires {displayedInstructionExpiry}
                </AppText>
              ) : null}
            </View>

            <AppCard
              backgroundColor={theme.colors.white}
              style={styles.paymentDetailsCard}
            >
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
                  handleCopyValue(
                    "Account number",
                    activePaymentInstruction?.accountNumber,
                  )
                }
              />
            </AppCard>

            <View style={styles.widgetButtonStack}>
              <AppButton
                disabled={isRefreshingPouchStatus}
                onPress={handleRefreshDepositStatus}
                title={
                  isRefreshingPouchStatus
                    ? "Checking payment"
                    : "I have paid, refresh status"
                }
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
        <AppText
          variant={
            props.label === "Account Number" ? "monoLarge" : "bodyMedium"
          }
        >
          {props.value}
        </AppText>
      </View>
      {props.actionLabel && props.onActionPress ? (
        <Pressable
          onPress={props.onActionPress}
          style={styles.inlineCopyButton}
        >
          <MaterialIcons
            color={theme.colors.black}
            name="content-copy"
            size={14}
          />
          <AppText variant="bodySmall">{props.actionLabel}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.md,
    paddingTop: theme.spacing.lg,
  },
  yieldCard: {
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.orange,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.orange,
    padding: theme.spacing.sm,
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
  statusPill: {
    alignSelf: "flex-start",
    borderWidth: theme.borders.regular,
    borderColor: "#F4B28D",
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.orangeLight,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
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
  timerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    borderRadius: theme.radii.pill,
    backgroundColor: "rgba(255,255,255,0.72)",
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
  bankPickerSheet: {
    maxHeight: "78%",
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
  bankLoadingState: {
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
  },
  bankInlineLoadingState: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  bankResultsList: {
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
  bankResultCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
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
  selectorInput: {
    minHeight: 50,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
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
