import MaterialIcons from "@expo/vector-icons/MaterialIcons";
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
import { MetricCard } from "@/components/MetricCard";
import { SectionHeader } from "@/components/SectionHeader";
import { WalletBalanceCard } from "@/components/WalletBalanceCard";
import { walletOverview } from "@/data/mock";
import { theme } from "@/theme";

type PaymentMethod = "card" | "bank-transfer" | null;

const paymentMethods = [
  {
    id: "card" as const,
    icon: "credit-card",
    title: "Card",
    subtitle: "Pay instantly with your debit or credit card.",
  },
  {
    id: "bank-transfer" as const,
    icon: "account-balance",
    title: "Bank transfer",
    subtitle: "Transfer from your bank app and confirm in checkout.",
  },
] as const;

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

export default function WalletScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    depositAmount?: string | string[];
    redirectReason?: string | string[];
    rideName?: string | string[];
  }>();
  const [depositAmount, setDepositAmount] = useState("");
  const [isDepositModalVisible, setDepositModalVisible] = useState(false);
  const [isPayOnlineModalVisible, setPayOnlineModalVisible] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const handledRedirectRef = useRef<string | null>(null);
  const formattedDepositAmount = depositAmount ? `NGN ${depositAmount}` : "NGN 0";
  const redirectReason = Array.isArray(params.redirectReason)
    ? params.redirectReason[0]
    : params.redirectReason;

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
    setSelectedMethod("card");
    setDepositModalVisible(false);
    setPayOnlineModalVisible(true);
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
    setSelectedMethod(null);
    setDepositModalVisible(true);
  };

  const closeDepositModal = () => {
    setDepositModalVisible(false);
  };

  const closePayOnlineModal = () => {
    setPayOnlineModalVisible(false);
  };

  const reopenDepositModal = () => {
    setPayOnlineModalVisible(false);
    setDepositModalVisible(true);
  };

  const handleWithdrawPress = () => {
    Alert.alert(
      "Withdrawals pending",
      "Withdraw will stay pending for now. Deposit flow comes first.",
    );
  };

  const handleDepositContinue = () => {
    if (!depositAmount.trim()) {
      Alert.alert(
        "Amount required",
        "Enter the amount you want to deposit in Naira.",
      );
      return;
    }

    setDepositModalVisible(false);
    if (!selectedMethod) {
      setSelectedMethod("card");
    }
    setPayOnlineModalVisible(true);
  };

  const handleProceedPayment = () => {
    if (!selectedMethod) {
      Alert.alert(
        "Select a payment method",
        "Choose card or bank transfer before continuing.",
      );
      return;
    }

    if (redirectReason === "insufficient-funds") {
      setPayOnlineModalVisible(false);
      router.replace("/matching");
      return;
    }

    Alert.alert(
      "Checkout ready",
      `${selectedMethod === "card" ? "Card" : "Bank transfer"} selected for ${formattedDepositAmount}.`,
    );
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
      if (!depositAmount.trim()) {
        setDepositModalVisible(true);
        return;
      }

      setPayOnlineModalVisible(true);
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
          subtitle="Fund your wallet in Naira, then choose how you want to pay online."
          title="Wallet"
          titleVariant="h1"
        />

        <WalletBalanceCard
          balance={walletOverview.balance}
          fiatApprox={walletOverview.fiatApprox}
          accountName={walletOverview.accountDetails.accountName}
          accountNumber={walletOverview.accountDetails.accountNumber}
          bankName={walletOverview.accountDetails.bankName}
          onDeposit={openDepositModal}
          onWithdraw={handleWithdrawPress}
        />

        <View style={styles.metricsRow}>
          <MetricCard
            accent="orange"
            backgroundColor={theme.colors.white}
            label="Yield today"
            value={walletOverview.yieldToday}
          />
          <MetricCard
            backgroundColor={theme.colors.white}
            label="Current APY"
            value={walletOverview.apy}
          />
        </View>

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
                  Enter the amount you want to fund before checkout.
                </AppText>
              </View>
              <Pressable onPress={closeDepositModal} style={styles.closeButton}>
                <MaterialIcons
                  color={theme.colors.black}
                  name="close"
                  size={18}
                />
              </Pressable>
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
                <AppButton onPress={handleDepositContinue} title="Continue" />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={closePayOnlineModal}
        transparent
        visible={isPayOnlineModalVisible}
      >
        <View style={styles.checkoutBackdrop}>
          <StatusBar style="dark" backgroundColor="rgba(13,13,13,0.44)" />
          <Pressable onPress={closePayOnlineModal} style={styles.checkoutOverlay} />
          <View style={styles.checkoutSheet}>
            <View style={styles.checkoutHandle} />

            <View style={styles.checkoutHeader}>
              <View style={styles.checkoutHeaderCopy}>
                <AppText variant="h2">Pay Online</AppText>
                <AppText variant="bodySmall" color={theme.colors.muted}>
                  Choose how you want to complete this deposit.
                </AppText>
              </View>
              <Pressable onPress={closePayOnlineModal} style={styles.backButton}>
                <MaterialIcons
                  color={theme.colors.black}
                  name="close"
                  size={18}
                />
              </Pressable>
            </View>

            <ScrollView
              bounces={false}
              contentContainerStyle={styles.checkoutContent}
              showsVerticalScrollIndicator={false}
            >
              <AppCard
                backgroundColor="#FFF7F0"
                borderColor="#F0B48D"
                style={styles.amountSummaryCard}
              >
                <View style={styles.amountSummaryHeader}>
                  <View style={styles.amountSummaryCopy}>
                    <AppText variant="bodySmall" color={theme.colors.muted}>
                      DEPOSIT AMOUNT
                    </AppText>
                    <AppText variant="h1">{formattedDepositAmount}</AppText>
                  </View>
                  <Pressable
                    onPress={reopenDepositModal}
                    style={styles.amountEditButton}
                  >
                    <AppText variant="caption">Edit amount</AppText>
                  </Pressable>
                </View>
              </AppCard>

              <View style={styles.paymentHeader}>
                <AppText variant="h3">Payment options</AppText>
                <AppText variant="bodySmall" color={theme.colors.muted}>
                  Pick one method to finish this deposit.
                </AppText>
              </View>

              <View style={styles.paymentMethodsList}>
                {paymentMethods.map((method) => {
                  const isSelected = selectedMethod === method.id;

                  return (
                    <Pressable
                      key={method.id}
                      onPress={() => setSelectedMethod(method.id)}
                      style={[
                        styles.methodCard,
                        isSelected ? styles.methodCardSelected : null,
                      ]}
                    >
                      <View style={styles.methodIconWrap}>
                        <MaterialIcons
                          color={theme.colors.orange}
                          name={method.icon}
                          size={18}
                        />
                      </View>
                      <View style={styles.methodCopy}>
                        <AppText variant="label">{method.title}</AppText>
                        <AppText variant="bodySmall" color={theme.colors.muted}>
                          {method.subtitle}
                        </AppText>
                      </View>
                      <View
                        style={[
                          styles.checkbox,
                          isSelected ? styles.checkboxSelected : null,
                        ]}
                      >
                        {isSelected ? (
                          <MaterialIcons
                            color={theme.colors.offWhite}
                            name="check"
                            size={14}
                          />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.checkoutFooter}>
              <AppButton
                onPress={handleProceedPayment}
                title={`Confirm payment of ${formattedDepositAmount}`}
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

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  metricsRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
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
  checkoutBackdrop: {
    flex: 1,
    backgroundColor: "rgba(13,13,13,0.44)",
    justifyContent: "flex-end",
  },
  checkoutOverlay: {
    flex: 1,
  },
  checkoutSheet: {
    maxHeight: "82%",
    borderTopLeftRadius: theme.radii.lg,
    borderTopRightRadius: theme.radii.lg,
    borderWidth: theme.borders.thick,
    borderBottomWidth: 0,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.offWhite,
    overflow: "hidden",
  },
  checkoutHandle: {
    alignSelf: "center",
    width: 56,
    height: 6,
    borderRadius: theme.radii.pill,
    backgroundColor: "#E0D4C7",
    marginTop: theme.spacing.sm,
  },
  checkoutHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.pill,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.subtle,
  },
  checkoutHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  checkoutContent: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  amountSummaryCard: {
    marginTop: theme.spacing.xs,
  },
  amountSummaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  amountSummaryCopy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  amountEditButton: {
    borderWidth: theme.borders.regular,
    borderColor: "#F0B48D",
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  paymentHeader: {
    gap: 2,
  },
  paymentMethodsList: {
    gap: theme.spacing.sm,
  },
  methodCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.white,
    padding: theme.spacing.sm,
    ...theme.shadows.card,
  },
  methodCardSelected: {
    backgroundColor: "#FFF0E1",
    borderColor: theme.colors.orange,
  },
  methodIconWrap: {
    width: 38,
    height: 38,
    borderRadius: theme.radii.pill,
    backgroundColor: "#FFF7F0",
    borderWidth: theme.borders.regular,
    borderColor: "#F0B48D",
    alignItems: "center",
    justifyContent: "center",
  },
  methodCopy: {
    flex: 1,
    gap: 2,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: theme.radii.pill,
    borderWidth: theme.borders.regular,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: theme.colors.orange,
    borderColor: theme.colors.orange,
  },
  checkoutFooter: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
    backgroundColor: "rgba(255,250,245,0.96)",
    borderTopWidth: 1,
    borderTopColor: "#E8DDD3",
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
