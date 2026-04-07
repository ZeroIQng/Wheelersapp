export type MetricStat = {
  id: string;
  label: string;
  value: string;
  accent?: 'orange' | 'green' | 'black' | 'danger';
};

export type RouteInstruction = {
  icon: string;
  title: string;
  subtitle: string;
};

export type RiderSnippet = {
  id: string;
  initials: string;
  name: string;
  rating: string;
  trips: string;
};

export type WalletTransaction = {
  id: string;
  title: string;
  timestamp: string;
  amount: string;
  direction: 'credit' | 'debit';
};

export type EarningsBarDatum = {
  id: string;
  label: string;
  value: number;
  active?: boolean;
};

export const riderTripDetails = {
  status: 'TRIP IN PROGRESS',
  substatus: 'On route',
  progress: 0.45,
  etaMinutes: 12,
  distanceKmLeft: 6.4,
  fare: '$1.85',
  pickup: 'Lekki Phase 1',
  destination: 'Victoria Island',
  metrics: [
    { id: 'eta', label: 'MIN LEFT', value: '12', accent: 'orange' },
    { id: 'distance', label: 'KM LEFT', value: '6.4' },
    { id: 'fare', label: 'FARE', value: '$1.85' },
  ] satisfies MetricStat[],
} as const;

export const driverDetails = {
  initials: 'EO',
  name: 'Emeka O.',
  rating: '4.9',
  vehicle: 'Toyota Corolla',
  plate: 'ABJ-234KL',
  avatarColor: '#FF5C00',
  etaMinutes: 2,
  fare: '$1.85',
  tripMinutes: 18,
} as const;

export const riderProfileSnippets: RiderSnippet[] = [
  {
    id: 'chinwe',
    initials: 'CA',
    name: 'Chinwe A.',
    rating: '4.8',
    trips: '22 trips',
  },
  {
    id: 'mide',
    initials: 'MO',
    name: 'Mide O.',
    rating: '4.9',
    trips: '41 trips',
  },
];

export const walletOverview = {
  balance: '$28.50',
  fiatApprox: '≈ ₦46,125',
  yieldToday: '+$0.42',
  apy: '8.2%',
  recentTransactions: [
    {
      id: 'ride-lekki',
      title: 'Ride to Lekki',
      timestamp: 'Today, 2:14 PM',
      amount: '-$1.85',
      direction: 'debit',
    },
    {
      id: 'deposit-ngn',
      title: 'NGN deposit',
      timestamp: 'Yesterday',
      amount: '+$30.00',
      direction: 'credit',
    },
    {
      id: 'yield',
      title: 'Daily yield',
      timestamp: 'Yesterday, 11:59 PM',
      amount: '+$0.42',
      direction: 'credit',
    },
  ] satisfies WalletTransaction[],
} as const;

export const driverDashboardSummary = {
  online: true,
  statusLabel: 'ACTIVE',
  nearbyLabel: 'Looking for rides nearby...',
  metrics: [
    { id: 'today', label: 'Today', value: '$12.40', accent: 'orange' },
    { id: 'rides', label: 'Rides', value: '7' },
    { id: 'rating', label: 'Rating', value: '4.9⭐' },
  ] satisfies MetricStat[],
} as const;

export const incomingRideRequest = {
  riderId: riderProfileSnippets[0].id,
  riderName: riderProfileSnippets[0].name,
  distanceAwayKm: 2.1,
  estimatedFare: '$3.20',
  rideDistanceKm: '8.4km',
  expiresInSeconds: 12,
  pickupLabel: 'Lekki Toll Gate',
  destinationLabel: 'Obalende Bus Stop',
} as const;

export const driverNavigationDetails = {
  status: 'HEADING TO PICKUP',
  metrics: [
    { id: 'away', label: 'MIN AWAY', value: '3', accent: 'orange' },
    { id: 'distance', label: 'KM LEFT', value: '1.2' },
    { id: 'fare', label: 'FARE', value: '$3.20' },
  ] satisfies MetricStat[],
  instruction: {
    icon: '↖',
    title: 'Turn Left',
    subtitle: 'AJOSE ADEOGUN ST — 200m',
  } satisfies RouteInstruction,
} as const;

export const driverArrivalState = {
  freeWaitLabel: 'Free wait time (3 min)',
  waitProgress: 0.68,
  rider: riderProfileSnippets[0],
} as const;

export const driverActiveTripDetails = {
  status: 'TRIP IN PROGRESS',
  substatus: 'Active',
  metrics: [
    { id: 'time', label: 'MIN LEFT', value: '18', accent: 'orange' },
    { id: 'distance', label: 'KM LEFT', value: '14.2' },
    { id: 'earnings', label: 'EARNING', value: '$3.20' },
  ] satisfies MetricStat[],
  instruction: {
    icon: '↗',
    title: 'Turn right in 500m',
    subtitle: 'AIRPORT ROAD — KEEP RIGHT LANE',
  } satisfies RouteInstruction,
} as const;

export const driverPayoutSummary = {
  payout: '$3.11',
  fiatApprox: '≈ ₦5,038',
  grossFare: '$3.20',
  platformFee: '-$0.09',
  platformFeeLabel: 'Platform fee (0.3%)',
  finalPayout: '$3.11',
} as const;

export const earningsSummary = {
  tabs: ['Today', 'Week', 'Month'],
  activeTab: 'Today',
  total: '$12.40',
  growth: '+18% vs yesterday',
  stats: [
    { id: 'rides', label: 'Rides', value: '7', accent: 'orange' },
    { id: 'avg-fare', label: 'Avg fare', value: '$1.77' },
    { id: 'fees-paid', label: 'Fees paid', value: '$0.04' },
  ] satisfies MetricStat[],
} as const;

export const dailyEarningsChart: EarningsBarDatum[] = [
  { id: 'mon', label: 'M', value: 38 },
  { id: 'tue', label: 'T', value: 55 },
  { id: 'wed', label: 'W', value: 44 },
  { id: 'thu', label: 'T', value: 70 },
  { id: 'fri', label: 'F', value: 52 },
  { id: 'sat', label: 'S', value: 68 },
  { id: 'sun', label: 'S', value: 90, active: true },
];

export const walletBalance = walletOverview.balance;

export const recentPlaces = [
  {
    id: 'market',
    emoji: '🏪',
    name: 'Balogun Market, Lagos',
    meta: '5.2km · ~12 min',
    distance: '5.2km',
  },
  {
    id: 'airport',
    emoji: '✈️',
    name: 'Murtala Airport',
    meta: '18km · ~32 min',
    distance: '18km',
  },
];

export const quickPlaces = [
  { id: 'home', emoji: '🏠', label: 'Home' },
  { id: 'work', emoji: '💼', label: 'Work' },
  { id: 'school', emoji: '🎓', label: 'School' },
];

export const rideOptions = [
  {
    id: 'economy',
    emoji: '🛵',
    name: 'Economy',
    meta: '4 min · 2 seats',
    price: '$1.20',
    accent: false,
  },
  {
    id: 'comfort',
    emoji: '🚗',
    name: 'Comfort',
    meta: '2 min · 4 seats',
    price: '$1.85',
    accent: true,
  },
  {
    id: 'xl',
    emoji: '🚌',
    name: 'XL / Bus',
    meta: '6 min · 6 seats',
    price: '$2.40',
    accent: false,
  },
];

export const driver = {
  initials: driverDetails.initials,
  name: driverDetails.name,
  rating: driverDetails.rating,
  vehicle: driverDetails.vehicle,
  plate: driverDetails.plate,
  etaMinutes: driverDetails.etaMinutes,
  fare: driverDetails.fare,
  tripMinutes: driverDetails.tripMinutes,
};

export const kycSteps = [
  {
    id: 'phone',
    title: 'Phone verified',
    subtitle: 'Complete',
    state: 'done' as const,
  },
  {
    id: 'id',
    title: 'Govt. ID Scan',
    subtitle: 'NIN / Passport / Voter card',
    state: 'active' as const,
  },
  {
    id: 'selfie',
    title: 'Selfie Match',
    subtitle: 'Unlocks after ID scan',
    state: 'locked' as const,
  },
];
