import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { BackArrow } from '@/components/back-arrow';
import { DecorativeBackground } from '@/components/DecorativeBackground';
import { DocumentStatusRow } from '@/components/DocumentStatusRow';
import { DocumentUploadCard } from '@/components/DocumentUploadCard';
import { driverDocuments } from '@/data/mock';
import { theme } from '@/theme';

export default function DriverDocsScreen() {
  return (
    <AppScreen backgroundColor={theme.colors.offWhite} scroll contentStyle={styles.container}>
      <StatusBar style="dark" backgroundColor={theme.colors.offWhite} />
      <DecorativeBackground motif="docs" />
      <View style={styles.headerRow}>
        <BackArrow />
        <View style={styles.headerCopy}>
          <AppText variant="screenTitle" numberOfLines={1}>Driver Docs</AppText>
          <AppText variant="bodySmall" color={theme.colors.muted} numberOfLines={2}>
            Upload once. Drive forever.
          </AppText>
        </View>
      </View>

      <View style={styles.section}>
        {driverDocuments.approved.map((item) => (
          <DocumentStatusRow item={item} key={item.id} />
        ))}
      </View>

      <DocumentUploadCard item={driverDocuments.upload} />
      <DocumentStatusRow item={driverDocuments.pending} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.md,
    paddingTop: theme.spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  section: {
    gap: theme.spacing.sm,
  },
});
