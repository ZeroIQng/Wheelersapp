import { Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BID_LIFETIME_MS, type PendingBid, type RideOffer } from '@/lib/driver-session-reducer';
import { useDriverSession } from '@/lib/driver-session';
import { haversineKm } from '@/lib/geo';
import { useAppLocation } from '@/lib/location';
import { stopRideRequestSound } from '@/lib/sounds';
import { theme } from '@/theme';

function formatNgn(amount: number): string {
  return `₦${Math.round(amount).toLocaleString('en-NG')}`;
}

function countdown(toMs: number, now: number): string | null {
  const remaining = Math.floor((toMs - now) / 1000);
  if (remaining <= 0) return null;
  return `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
}

const BID_INCREMENTS = [100, 200, 500];

/**
 * The driver's job feed, inDrive-style: every ride is ONE card for its whole
 * life. A new request shows the rider's price with Accept / bid chips right
 * on the card; once answered it becomes the bid card ("waiting ⏳"), a rider
 * counter updates that same card, and timeout/decline removes it. The same
 * ride never appears twice, and nothing on screen outlives its auction.
 */
export function DriverRequestFeed() {
  const router = useRouter();
  const { session, acceptRide, selectOffer } = useDriverSession();
  const { currentLocation } = useAppLocation();
  const [now, setNow] = useState(() => Date.now());
  const [bidOpenFor, setBidOpenFor] = useState<string | null>(null);
  const [busyRideId, setBusyRideId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const bids = Object.values(session.pendingBids).sort(
    (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
  );
  const answered = new Set(bids.map((bid) => bid.offer.rideId));
  const requests = session.offers
    .filter((offer) => !answered.has(offer.rideId))
    .sort((a, b) => (distanceKm(a) ?? 99) - (distanceKm(b) ?? 99));

  function distanceKm(offer: RideOffer): number | null {
    if (!currentLocation) return null;
    return haversineKm(currentLocation.lat, currentLocation.lng, offer.pickup.lat, offer.pickup.lng);
  }

  async function sendBid(offer: RideOffer, amountNgn: number) {
    if (busyRideId) return;
    setBusyRideId(offer.rideId);
    try {
      void stopRideRequestSound();
      await acceptRide(offer.rideId, amountNgn, currentLocation ?? undefined);
      setBidOpenFor(null);
    } catch (err) {
      Alert.alert('Could not send bid', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusyRideId(null);
    }
  }

  function openDetails(rideId: string) {
    void stopRideRequestSound();
    selectOffer(rideId);
    router.push('/driver/incoming-request' as Href);
  }

  if (bids.length === 0 && requests.length === 0) return null;

  return (
    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
      {bids.map((bid) => renderBidCard(bid))}
      {requests.map((offer) => renderRequestCard(offer))}
    </ScrollView>
  );

  // ── One life-cycle card: the bid states ─────────────────────────────────
  function renderBidCard(bid: PendingBid) {
    const { offer } = bid;
    const riderAsk = offer.riderOfferNgn ?? offer.fareEstimateNgn;
    const accepted = Boolean(bid.acceptedAt);
    const countered = Boolean(bid.counteredAt) && riderAsk !== bid.amountNgn;
    const timeLeft = countdown(
      new Date(bid.counteredAt ?? bid.sentAt).getTime() + BID_LIFETIME_MS - 30_000,
      now,
    );

    return (
      <Pressable
        key={offer.rideId}
        onPress={() => router.push(`/driver/pending-bid?rideId=${encodeURIComponent(offer.rideId)}` as Href)}
        style={({ pressed }) => [
          styles.card,
          accepted ? styles.cardAccepted : countered ? styles.cardCountered : styles.cardBid,
          pressed && styles.pressed,
        ]}>
        <View style={styles.topRow}>
          <AppText variant="h3" color={accepted ? theme.colors.orange : theme.colors.green}>
            {accepted
              ? bid.riderPaid ? '✅ Rider paid' : '✅ Accepted'
              : countered
                ? `Rider offers ${formatNgn(riderAsk)}`
                : `You offered ${formatNgn(bid.amountNgn)}`}
          </AppText>
          {!accepted && timeLeft ? (
            <AppText variant="mono" color={theme.colors.muted}>⏳ {timeLeft}</AppText>
          ) : null}
        </View>
        <AppText variant="bodySmall" color={theme.colors.muted} numberOfLines={1}>
          {offer.pickup.address} → {offer.destination.address}
        </AppText>

        {accepted ? (
          <AppText variant="bodySmall" color={theme.colors.muted}>Starting your trip…</AppText>
        ) : countered ? (
          <View style={styles.actionsRow}>
            <Pressable
              disabled={busyRideId === offer.rideId}
              onPress={() => void sendBid(offer, riderAsk)}
              style={({ pressed }) => [styles.acceptBtn, pressed && styles.pressed]}>
              <AppText variant="label" color={theme.colors.white}>Accept {formatNgn(riderAsk)}</AppText>
            </Pressable>
            {BID_INCREMENTS.slice(0, 2).map((step) => (
              <Pressable
                key={step}
                disabled={busyRideId === offer.rideId}
                onPress={() => void sendBid(offer, riderAsk + step)}
                style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
                <AppText variant="label">+{step}</AppText>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.actionsRow}>
            {riderAsk !== bid.amountNgn ? (
              <Pressable
                disabled={busyRideId === offer.rideId}
                onPress={() => void sendBid(offer, riderAsk)}
                style={({ pressed }) => [styles.acceptBtn, pressed && styles.pressed]}>
                <AppText variant="label" color={theme.colors.white}>Accept {formatNgn(riderAsk)}</AppText>
              </Pressable>
            ) : (
              <AppText variant="caption" color={theme.colors.mutedLight} style={styles.waitNote}>
                You can keep taking other requests
              </AppText>
            )}
            <Pressable
              onPress={() => router.push(`/driver/pending-bid?rideId=${encodeURIComponent(offer.rideId)}` as Href)}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
              <AppText variant="label">Change bid</AppText>
            </Pressable>
          </View>
        )}
      </Pressable>
    );
  }

  // ── One life-cycle card: the fresh request state ────────────────────────
  function renderRequestCard(offer: RideOffer) {
    const riderAsk = offer.riderOfferNgn ?? offer.fareEstimateNgn;
    const km = distanceKm(offer);
    const expiresMs = new Date(offer.expiresAt).getTime();
    const timeLeft = Number.isFinite(expiresMs) ? countdown(expiresMs, now) : null;
    const bidOpen = bidOpenFor === offer.rideId;

    return (
      <View key={offer.rideId} style={[styles.card, styles.cardRequest]}>
        <Pressable onPress={() => openDetails(offer.rideId)}>
          <View style={styles.topRow}>
            <AppText variant="h2" color={theme.colors.orange}>{formatNgn(riderAsk)}</AppText>
            <View style={styles.metaRight}>
              {timeLeft ? <AppText variant="mono" color={theme.colors.muted}>⏳ {timeLeft}</AppText> : null}
              <AppText variant="bodySmall" color={theme.colors.muted}>
                {km === null ? '' : `${km < 10 ? km.toFixed(1) : Math.round(km)} km away`}
                {offer.plannedDistanceKm ? ` · ${offer.plannedDistanceKm.toFixed(1)} km trip` : ''}
              </AppText>
            </View>
          </View>
          <AppText variant="body" numberOfLines={1}>{offer.pickup.address}</AppText>
          <AppText variant="bodySmall" color={theme.colors.muted} numberOfLines={1}>
            → {offer.destination.address}
            {offer.isGroupRide ? `  · group · ${offer.riderCount ?? 2} riders` : ''}
          </AppText>
        </Pressable>

        {/* Group rides negotiate per seat — that lives on the details screen. */}
        {offer.isGroupRide ? (
          <View style={styles.actionsRow}>
            <Pressable
              onPress={() => openDetails(offer.rideId)}
              style={({ pressed }) => [styles.acceptBtn, pressed && styles.pressed]}>
              <AppText variant="label" color={theme.colors.white}>View seats</AppText>
            </Pressable>
          </View>
        ) : bidOpen ? (
          <View style={styles.actionsRow}>
            {BID_INCREMENTS.map((step) => (
              <Pressable
                key={step}
                disabled={busyRideId === offer.rideId}
                onPress={() => void sendBid(offer, riderAsk + step)}
                style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
                <AppText variant="label">+{step}</AppText>
              </Pressable>
            ))}
            <Pressable
              onPress={() => openDetails(offer.rideId)}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
              <AppText variant="label" color={theme.colors.muted}>Custom…</AppText>
            </Pressable>
            <Pressable onPress={() => setBidOpenFor(null)} style={styles.cancelChip}>
              <AppText variant="label" color={theme.colors.muted}>✕</AppText>
            </Pressable>
          </View>
        ) : (
          <View style={styles.actionsRow}>
            <Pressable
              disabled={busyRideId === offer.rideId}
              onPress={() => void sendBid(offer, riderAsk)}
              style={({ pressed }) => [styles.acceptBtn, pressed && styles.pressed]}>
              <AppText variant="label" color={theme.colors.white}>
                Accept {formatNgn(riderAsk)}
              </AppText>
            </Pressable>
            <Pressable
              onPress={() => setBidOpenFor(offer.rideId)}
              style={({ pressed }) => [styles.bidBtn, pressed && styles.pressed]}>
              <AppText variant="label">Your price</AppText>
            </Pressable>
          </View>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  scroll: {
    maxHeight: 380,
  },
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.radii.md,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    gap: 6,
    ...theme.shadows.card,
  },
  cardRequest: {
    borderColor: theme.colors.orange,
  },
  cardBid: {
    borderColor: theme.colors.green,
  },
  cardCountered: {
    borderColor: theme.colors.orange,
    backgroundColor: theme.colors.orangeLight,
  },
  cardAccepted: {
    borderColor: theme.colors.orange,
    backgroundColor: theme.colors.orangeLight,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  metaRight: {
    alignItems: 'flex-end',
    gap: 2,
    flexShrink: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: 2,
  },
  acceptBtn: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.sm,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.green,
  },
  bidBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radii.sm,
    borderWidth: theme.borders.thick,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.white,
  },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.white,
  },
  cancelChip: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: theme.spacing.sm,
  },
  waitNote: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
