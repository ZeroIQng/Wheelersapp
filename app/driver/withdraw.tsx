import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { useAppTheme } from '@/lib/theme-context';
import { useWalletOverview } from '@/lib/wallet-overview';
import { theme } from '@/theme';

// ── Mock bank list (UI only) ──────────────────────────
const BANKS = [
  { id: '1', name: 'Access Bank', code: '044' },
  { id: '2', name: 'First Bank', code: '011' },
  { id: '3', name: 'GTBank', code: '058' },
  { id: '4', name: 'Kuda Bank', code: '090267' },
  { id: '5', name: 'Moniepoint MFB', code: '50515' },
  { id: '6', name: 'OPay', code: '999992' },
  { id: '7', name: 'PalmPay', code: '999991' },
  { id: '8', name: 'Sterling Bank', code: '232' },
  { id: '9', name: 'UBA', code: '033' },
  { id: '10', name: 'Union Bank', code: '032' },
  { id: '11', name: 'Wema Bank', code: '035' },
  { id: '12', name: 'Zenith Bank', code: '057' },
];

function formatNgn(amount: number): string {
  return `NGN ${Math.round(amount).toLocaleString('en-NG')}`;
}

// ── Icons ─────────────────────────────────────────────
function BackIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={theme.colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Line x1="19" y1="12" x2="5" y2="12" />
      <Polyline points="12 19 5 12 12 5" />
    </Svg>
  );
}

function BankIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={theme.colors.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 22V8l9-6 9 6v14" />
      <Path d="M7 22V12h4v10" />
      <Path d="M13 22V12h4v10" />
      <Line x1="2" y1="22" x2="22" y2="22" />
    </Svg>
  );
}

function ChevronDownIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={theme.colors.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="6 9 12 15 18 9" />
    </Svg>
  );
}

function CheckIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={theme.colors.orange} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="20 6 9 17 4 12" />
    </Svg>
  );
}

function SearchIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={theme.colors.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="11" cy="11" r="8" />
      <Line x1="21" y1="21" x2="16.65" y2="16.65" />
    </Svg>
  );
}

// ── Steps ─────────────────────────────────────────────
type Step = 'bank' | 'account' | 'amount' | 'confirm';

export default function DriverWithdrawScreen() {
  const router = useRouter();
  const { isDark } = useAppTheme();
  const { overview } = useWalletOverview();
  const balanceNgn = overview?.balanceNgn ?? 0;

  const [step, setStep] = useState<Step>('bank');
  const [selectedBank, setSelectedBank] = useState<typeof BANKS[0] | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [amount, setAmount] = useState('');
  const [bankSearchQuery, setBankSearchQuery] = useState('');
  const [showBankModal, setShowBankModal] = useState(false);

  const accountRef = useRef<TextInput>(null);
  const amountRef = useRef<TextInput>(null);

  const filteredBanks = bankSearchQuery
    ? BANKS.filter((b) => b.name.toLowerCase().includes(bankSearchQuery.toLowerCase()))
    : BANKS;

  const handleSelectBank = (bank: typeof BANKS[0]) => {
    setSelectedBank(bank);
    setShowBankModal(false);
    setStep('account');
    setTimeout(() => accountRef.current?.focus(), 300);
  };

  const handleAccountNext = () => {
    if (accountNumber.length < 10) {
      Alert.alert('Invalid', 'Please enter a valid 10-digit account number');
      return;
    }
    // Mock account name resolution
    setAccountName('JOHN DOE');
    setStep('amount');
    setTimeout(() => amountRef.current?.focus(), 300);
  };

  const handleAmountNext = () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      Alert.alert('Invalid', 'Please enter a valid amount');
      return;
    }
    if (numAmount > balanceNgn) {
      Alert.alert('Insufficient balance', `Your available balance is ${formatNgn(balanceNgn)}`);
      return;
    }
    setStep('confirm');
  };

  const handleConfirm = () => {
    Alert.alert(
      'Withdrawal submitted',
      `${formatNgn(parseFloat(amount))} will be sent to ${accountName} at ${selectedBank?.name}`,
      [{ text: 'Done', onPress: () => router.back() }],
    );
  };

  const handleBack = () => {
    if (step === 'bank') {
      router.back();
    } else if (step === 'account') {
      setStep('bank');
    } else if (step === 'amount') {
      setStep('account');
    } else {
      setStep('amount');
    }
  };

  const stepTitle = {
    bank: 'Select bank',
    account: 'Account number',
    amount: 'Enter amount',
    confirm: 'Confirm withdrawal',
  }[step];

  return (
    <AppScreen contentStyle={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleBack} hitSlop={12} style={[styles.backBtn, isDark && { backgroundColor: theme.colors.darkSurface }]}>
            <BackIcon />
          </Pressable>
          <AppText variant="h1">Withdraw</AppText>
        </View>

        {/* Step indicator */}
        <View style={styles.stepRow}>
          {(['bank', 'account', 'amount', 'confirm'] as Step[]).map((s, i) => (
            <View key={s} style={styles.stepItemWrap}>
              <View style={[
                styles.stepDot,
                s === step && styles.stepDotActive,
                (['bank', 'account', 'amount', 'confirm'] as Step[]).indexOf(step) > i && styles.stepDotDone,
              ]} />
              {i < 3 && <View style={[
                styles.stepLine,
                (['bank', 'account', 'amount', 'confirm'] as Step[]).indexOf(step) > i && styles.stepLineDone,
              ]} />}
            </View>
          ))}
        </View>

        <AppText variant="h2" style={styles.stepTitle}>{stepTitle}</AppText>

        {/* ── Step: Select Bank ── */}
        {step === 'bank' && (
          <View style={styles.stepContent}>
            <Pressable
              onPress={() => setShowBankModal(true)}
              style={[styles.selectField, isDark && { backgroundColor: theme.colors.darkSurface, borderColor: theme.colors.darkBorder }]}
            >
              <BankIcon />
              <AppText
                variant="body"
                color={selectedBank ? (isDark ? theme.colors.offWhite : theme.colors.black) : theme.colors.muted}
                style={styles.selectText}
              >
                {selectedBank ? selectedBank.name : 'Choose your bank'}
              </AppText>
              <ChevronDownIcon />
            </Pressable>

            {selectedBank && (
              <Pressable
                onPress={() => setStep('account')}
                style={({ pressed }) => [styles.nextBtn, pressed && styles.btnPressed]}
              >
                <AppText variant="label" color={theme.colors.white}>Continue</AppText>
              </Pressable>
            )}
          </View>
        )}

        {/* ── Step: Account Number ── */}
        {step === 'account' && (
          <View style={styles.stepContent}>
            <View style={styles.bankChip}>
              <BankIcon size={16} />
              <AppText variant="bodySmall" color={theme.colors.muted}>{selectedBank?.name}</AppText>
            </View>

            <View style={[styles.inputWrap, isDark && { backgroundColor: theme.colors.darkSurface, borderColor: theme.colors.darkBorder }]}>
              <AppText variant="bodySmall" color={theme.colors.muted} style={styles.inputLabel}>
                Account number
              </AppText>
              <TextInput
                ref={accountRef}
                style={[styles.input, isDark && { color: theme.colors.offWhite }]}
                value={accountNumber}
                onChangeText={(t) => setAccountNumber(t.replace(/\D/g, '').slice(0, 10))}
                placeholder="0123456789"
                placeholderTextColor={theme.colors.mutedLight}
                keyboardType="number-pad"
                maxLength={10}
                autoFocus
              />
            </View>

            {accountNumber.length === 10 && (
              <Pressable
                onPress={handleAccountNext}
                style={({ pressed }) => [styles.nextBtn, pressed && styles.btnPressed]}
              >
                <AppText variant="label" color={theme.colors.white}>Verify & continue</AppText>
              </Pressable>
            )}
          </View>
        )}

        {/* ── Step: Amount ── */}
        {step === 'amount' && (
          <View style={styles.stepContent}>
            <View style={styles.bankChip}>
              <AppText variant="bodySmall" color={theme.colors.muted}>
                {selectedBank?.name} — {accountNumber}
              </AppText>
            </View>
            <View style={styles.resolvedName}>
              <CheckIcon />
              <AppText variant="bodyMedium">{accountName}</AppText>
            </View>

            <View style={[styles.inputWrap, isDark && { backgroundColor: theme.colors.darkSurface, borderColor: theme.colors.darkBorder }]}>
              <AppText variant="bodySmall" color={theme.colors.muted} style={styles.inputLabel}>
                Amount (NGN)
              </AppText>
              <TextInput
                ref={amountRef}
                style={[styles.input, styles.amountInput]}
                value={amount}
                onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
                placeholder="0.00"
                placeholderTextColor={theme.colors.mutedLight}
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>

            <AppText variant="bodySmall" color={theme.colors.muted}>
              Available: {formatNgn(balanceNgn)}
            </AppText>

            {parseFloat(amount) > 0 && (
              <Pressable
                onPress={handleAmountNext}
                style={({ pressed }) => [styles.nextBtn, pressed && styles.btnPressed]}
              >
                <AppText variant="label" color={theme.colors.white}>Review</AppText>
              </Pressable>
            )}
          </View>
        )}

        {/* ── Step: Confirm ── */}
        {step === 'confirm' && (
          <View style={styles.stepContent}>
            <View style={styles.confirmCard}>
              <View style={styles.confirmRow}>
                <AppText variant="bodySmall" color={theme.colors.muted}>Bank</AppText>
                <AppText variant="bodyMedium">{selectedBank?.name}</AppText>
              </View>
              <View style={styles.confirmDivider} />
              <View style={styles.confirmRow}>
                <AppText variant="bodySmall" color={theme.colors.muted}>Account</AppText>
                <AppText variant="bodyMedium">{accountNumber}</AppText>
              </View>
              <View style={styles.confirmDivider} />
              <View style={styles.confirmRow}>
                <AppText variant="bodySmall" color={theme.colors.muted}>Name</AppText>
                <AppText variant="bodyMedium">{accountName}</AppText>
              </View>
              <View style={styles.confirmDivider} />
              <View style={styles.confirmRow}>
                <AppText variant="bodySmall" color={theme.colors.muted}>Amount</AppText>
                <AppText variant="h2" color={theme.colors.orange}>{formatNgn(parseFloat(amount))}</AppText>
              </View>
            </View>

            <Pressable
              onPress={handleConfirm}
              style={({ pressed }) => [styles.confirmBtn, pressed && styles.btnPressed]}
            >
              <AppText variant="label" color={theme.colors.white}>Confirm withdrawal</AppText>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* ── Bank selection modal ── */}
      <Modal visible={showBankModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AppText variant="h2">Select bank</AppText>
              <Pressable onPress={() => setShowBankModal(false)} hitSlop={12}>
                <AppText variant="label" color={theme.colors.orange}>Close</AppText>
              </Pressable>
            </View>

            {/* Search */}
            <View style={styles.searchWrap}>
              <SearchIcon />
              <TextInput
                style={styles.searchInput}
                value={bankSearchQuery}
                onChangeText={setBankSearchQuery}
                placeholder="Search banks..."
                placeholderTextColor={theme.colors.mutedLight}
                autoFocus
              />
            </View>

            <FlatList
              data={filteredBanks}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleSelectBank(item)}
                  style={({ pressed }) => [
                    styles.bankItem,
                    pressed && { backgroundColor: theme.colors.orangeLight },
                    selectedBank?.id === item.id && styles.bankItemSelected,
                  ]}
                >
                  <View style={styles.bankIconWrap}>
                    <BankIcon size={18} />
                  </View>
                  <AppText variant="body" style={styles.bankName}>{item.name}</AppText>
                  {selectedBank?.id === item.id && <CheckIcon />}
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    paddingTop: theme.spacing.lg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },

  // Step indicator
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  stepItemWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.borderLight,
  },
  stepDotActive: {
    backgroundColor: theme.colors.orange,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  stepDotDone: {
    backgroundColor: theme.colors.orange,
  },
  stepLine: {
    width: 60,
    height: 2,
    backgroundColor: theme.colors.borderLight,
    marginHorizontal: 4,
  },
  stepLineDone: {
    backgroundColor: theme.colors.orange,
  },
  stepTitle: {
    marginBottom: 20,
  },

  // Step content
  stepContent: {
    gap: 16,
  },

  // Select field
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  selectText: {
    flex: 1,
  },

  // Bank chip
  bankChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.orangeLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },

  // Resolved name
  resolvedName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Input
  inputWrap: {
    backgroundColor: theme.colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    padding: 16,
    gap: 8,
  },
  inputLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    fontFamily: 'ClashDisplay_600Semibold',
    fontSize: 18,
    color: theme.colors.black,
    padding: 0,
  },
  amountInput: {
    fontSize: 28,
    fontFamily: 'ClashDisplay_700Bold',
  },

  // Next button
  nextBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: theme.colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },

  // Confirm card
  confirmCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    padding: 20,
    gap: 0,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10 },
      android: { elevation: 3 },
    }),
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  confirmDivider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
  },
  confirmBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: theme.colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.offWhite,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 12,
  },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'ClashDisplay_500Medium',
    fontSize: 14,
    color: theme.colors.black,
    padding: 0,
  },

  // Bank list item
  bankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  bankItemSelected: {
    backgroundColor: theme.colors.orangeLight,
  },
  bankIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  bankName: {
    flex: 1,
  },
});
