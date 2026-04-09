import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { BackArrow } from '@/components/back-arrow';
import { DecorativeBackground } from '@/components/DecorativeBackground';
import { PromoCard } from '@/components/PromoCard';
import { SearchField } from '@/components/SearchField';
import { promoCodes } from '@/data/mock';
import { theme } from '@/theme';

export default function PromosScreen() {
  const [code, setCode] = useState('');

  return (
    <AppScreen backgroundColor={theme.colors.offWhite} scroll contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />
      <DecorativeBackground motif="promos" />
      <View style={styles.headerRow}>
        <BackArrow />
        <View style={styles.headerCopy}>
          <AppText variant="screenTitle">Promo Codes</AppText>
          <AppText variant="bodySmall" color={theme.colors.muted}>
            Enter a code or pick an active deal
          </AppText>
        </View>
      </View>

      <View style={styles.inputRow}>
        <View style={styles.inputField}>
          <SearchField onChangeText={setCode} placeholder={promoCodes.placeholder} value={code} />
        </View>
        <AppButton style={styles.applyButton} title="Apply" />
      </View>

      <View style={styles.section}>
        <AppText variant="monoSmall" color={theme.colors.muted}>
          ACTIVE DEALS
        </AppText>
        <View style={styles.list}>
          {promoCodes.active.map((promo) => (
            <PromoCard key={promo.id} promo={promo} />
          ))}
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  headerCopy: {
    flex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  inputField: {
    flex: 1,
  },
  applyButton: {
    width: 92,
  },
  section: {
    gap: theme.spacing.sm,
  },
  list: {
    gap: theme.spacing.sm,
  },
});
