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

export type MapCoordinate = {
  latitude: number;
  longitude: number;
};

export type MapRegion = MapCoordinate & {
  latitudeDelta: number;
  longitudeDelta: number;
};

export type MapScene = {
  id: string;
  region: MapRegion;
  route?: MapCoordinate[];
  primaryMarker?: MapCoordinate;
  secondaryMarker?: MapCoordinate;
  pulseMarker?: MapCoordinate;
};

export type NotificationItem = {
  id: string;
  icon: string;
  title: string;
  message: string;
  timestamp: string;
  unread?: boolean;
  accent?: 'orange' | 'green' | 'black';
};

export type SettingOption = {
  id: string;
  icon: string;
  title: string;
  subtitle?: string;
  type: 'navigation' | 'toggle' | 'value' | 'danger';
  route?: string;
  value?: string;
};

export type SupportMessage = {
  id: string;
  sender: 'support' | 'user';
  text: string;
  timestamp: string;
};

export type DriverDocument = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  status: 'approved' | 'pending' | 'missing';
};

export type TokenActivity = {
  id: string;
  title: string;
  timestamp: string;
  amount: string;
  direction: 'credit' | 'debit';
};

export type PromoOffer = {
  id: string;
  title: string;
  description: string;
  code: string;
  expiry: string;
  highlighted?: boolean;
};

export type HelpTopic = {
  id: string;
  icon: string;
  title: string;
  badge?: string;
};

export type EmergencyStatus = {
  id: string;
  icon: string;
  title: string;
  detail: string;
  tone: 'live' | 'pending';
  label?: string;
};

export type RoleMode = {
  id: 'rider' | 'driver';
  title: string;
  subtitle: string;
  icon: string;
};

export type DriverWalletEntry = {
  id: string;
  title: string;
  timestamp: string;
  amount: string;
  direction: 'credit' | 'debit';
};

export type RideHistoryEntry = {
  id: string;
  title: string;
  meta: string;
  fare: string;
  icon: string;
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
  accountDetails: {
    bankName: 'WheelerPay MFB',
    accountNumber: '1023847561',
    accountName: 'Wheelers Rider',
  },
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

export const riderHomeHistory: RideHistoryEntry[] = [
  {
    id: 'marina-lekki',
    title: 'Marina to Lekki Phase 1',
    meta: 'Today, 2:14 PM',
    fare: '$1.85',
    icon: 'history',
  },
  {
    id: 'airport-pickup',
    title: 'Airport pickup',
    meta: 'Yesterday, 8:05 PM',
    fare: '$3.40',
    icon: 'schedule',
  },
  {
    id: 'vi-dropoff',
    title: 'Victoria Island dropoff',
    meta: 'Yesterday, 1:23 PM',
    fare: '$2.25',
    icon: 'directions-car',
  },
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

export const notificationsFeed = {
  unread: [
    {
      id: 'driver-accepted',
      icon: '🚗',
      title: 'Driver on the way!',
      message: 'Emeka O. accepted your ride. ETA 2 min.',
      timestamp: '2 min ago',
      unread: true,
      accent: 'orange',
    },
    {
      id: 'yield-credit',
      icon: '💰',
      title: 'Yield credited',
      message: '+$0.42 added to your wallet balance.',
      timestamp: '1 hr ago',
      unread: true,
      accent: 'green',
    },
  ] satisfies NotificationItem[],
  earlier: [
    {
      id: 'rating',
      icon: '⭐',
      title: 'Rating received',
      message: 'Your driver rated you 5 stars.',
      timestamp: 'Yesterday',
      accent: 'black',
    },
    {
      id: 'promo',
      icon: '🎁',
      title: 'Promo unlocked',
      message: '20% off your next 3 rides.',
      timestamp: '2d ago',
      accent: 'black',
    },
  ] satisfies NotificationItem[],
} as const;

export const userProfile = {
  initials: 'CA',
  name: 'Chinwe Adeola',
  email: 'chinwe@email.com',
  verificationState: 'Verified account',
  badges: [
    { id: 'rider', label: 'RIDER', variant: 'orange' as const },
    { id: 'verified', label: 'VERIFIED', variant: 'green' as const },
  ],
  stats: [
    { id: 'rides', label: 'Rides', value: '128' },
    { id: 'rating', label: 'Rating', value: '4.8' },
  ],
} as const;

export const settingsOptions = [
  {
    id: 'edit-profile',
    icon: '👤',
    title: 'Edit profile',
    type: 'navigation',
  },
  {
    id: 'notifications',
    icon: '🔔',
    title: 'Notifications',
    type: 'toggle',
  },
  {
    id: 'security',
    icon: '🔐',
    title: 'Security & PIN',
    type: 'navigation',
  },
  {
    id: 'language',
    icon: '🌍',
    title: 'Language',
    type: 'value',
    value: 'English',
  },
  {
    id: 'switch-driver',
    icon: '🔄',
    title: 'Switch to Driver',
    subtitle: 'Activate driver mode',
    type: 'navigation',
    route: '/shared/role-switcher',
  },
  {
    id: 'logout',
    icon: '🚪',
    title: 'Log out',
    type: 'danger',
  },
] satisfies SettingOption[];

export const supportChat = {
  agentName: 'Wheleers Support',
  status: 'Online now',
  avatar: '🤖',
  messages: [
    {
      id: 'support-1',
      sender: 'support',
      text: 'Hi Chinwe! 👋 How can I help you today?',
      timestamp: '10:42 AM',
    },
    {
      id: 'user-1',
      sender: 'user',
      text: 'I left my phone in the car after my last ride',
      timestamp: '10:43 AM',
    },
    {
      id: 'support-2',
      sender: 'support',
      text: "No worries! I'll contact Emeka O. right now. You can also call him directly.",
      timestamp: '10:43 AM',
    },
  ] satisfies SupportMessage[],
  quickReplies: ['Call driver', 'Report issue', 'Get refund'],
  typing: true,
} as const;

export const driverDocuments = {
  approved: [
    {
      id: 'license',
      title: "Driver's Licence",
      subtitle: 'Expires Mar 2027',
      icon: '✅',
      status: 'approved',
    },
    {
      id: 'registration',
      title: 'Vehicle Registration',
      subtitle: 'Toyota Corolla 2020',
      icon: '✅',
      status: 'approved',
    },
  ] satisfies DriverDocument[],
  upload: {
    id: 'insurance',
    title: 'Upload Insurance',
    subtitle: 'JPG, PNG or PDF · Max 5MB',
    icon: '📤',
    status: 'missing',
  } satisfies DriverDocument,
  pending: {
    id: 'vehicle-photo',
    title: 'Vehicle Photo',
    subtitle: 'Not yet uploaded',
    icon: '📸',
    status: 'pending',
  } satisfies DriverDocument,
} as const;

export const tokenPortfolio = {
  balance: '1,240 WHE',
  fiatApprox: '≈ $18.60 USDT',
  stakedBalance: '840 WHE',
  apy: '12.4%',
  dailyEarnings: '+4.20',
  activity: [
    {
      id: 'ride-reward',
      title: 'Ride reward',
      timestamp: 'Today 2:14 PM',
      amount: '+12 WHE',
      direction: 'credit',
    },
    {
      id: 'staking-reward',
      title: 'Staking reward',
      timestamp: 'Yesterday',
      amount: '+4.20 WHE',
      direction: 'credit',
    },
    {
      id: 'swap-fee',
      title: 'Swap fee',
      timestamp: 'Yesterday 8:02 AM',
      amount: '-1.20 WHE',
      direction: 'debit',
    },
  ] satisfies TokenActivity[],
} as const;

export const referralProgram = {
  headline: 'Refer & Earn',
  supportingText: 'Invite friends. Both of you get rewarded.',
  rewards: [
    { id: 'you', title: 'You get', value: '$2.00', icon: '🎁', accent: true },
    { id: 'friend', title: 'They get', value: '$1.00', icon: '🤝', accent: false },
  ],
  referralCode: 'WHE-CHINWE',
  successfulReferrals: 12,
  totalEarned: '$24.00',
} as const;

export const promoCodes = {
  placeholder: 'PROMO CODE...',
  active: [
    {
      id: 'welcome20',
      title: '20% OFF',
      description: 'Next 3 rides',
      code: 'WELCOME20',
      expiry: 'Expires in 6 days',
      highlighted: true,
    },
    {
      id: 'friend',
      title: 'FREE RIDE',
      description: 'Up to $3.00',
      code: 'FRIEND',
      expiry: 'Expires in 14 days',
    },
  ] satisfies PromoOffer[],
} as const;

export const helpCenter = {
  searchPlaceholder: 'Search help articles...',
  topics: [
    { id: 'billing', icon: '🧾', title: 'How billing works' },
    { id: 'security', icon: '🔐', title: 'Account security' },
    { id: 'refunds', icon: '💸', title: 'Refund policy' },
    { id: 'cancellations', icon: '🚗', title: 'Cancellation rules' },
    { id: 'token-guide', icon: '🪙', title: 'WHE Token guide', badge: 'NEW' },
  ] satisfies HelpTopic[],
} as const;

export const emergencyState = {
  eyebrow: 'EMERGENCY',
  title: 'Stay calm.\nHelp is coming.',
  reassurance: 'Your location has been shared with emergency contacts.',
  statuses: [
    {
      id: 'location',
      icon: '📍',
      title: 'Location shared',
      detail: 'Lekki Phase 1, Lagos',
      tone: 'live',
      label: 'LIVE',
    },
    {
      id: 'services',
      icon: '🚓',
      title: 'Emergency services',
      detail: 'Being notified...',
      tone: 'pending',
    },
  ] satisfies EmergencyStatus[],
} as const;

export const roleModes = {
  activeRole: 'rider' as const,
  roles: [
    {
      id: 'rider',
      title: 'Rider Mode',
      subtitle: 'Currently active',
      icon: '🛵',
    },
    {
      id: 'driver',
      title: 'Driver Mode',
      subtitle: 'Tap to activate',
      icon: '🚗',
    },
  ] satisfies RoleMode[],
  reassurance: 'Your ratings and wallet stay the same',
} as const;

export const mapScenes = {
  riderHome: {
    id: 'rider-home',
    region: {
      latitude: 6.4365,
      longitude: 3.4553,
      latitudeDelta: 0.035,
      longitudeDelta: 0.03,
    },
    primaryMarker: {
      latitude: 6.4365,
      longitude: 3.4553,
    },
  },
  rideSelection: {
    id: 'ride-selection',
    region: {
      latitude: 6.4476,
      longitude: 3.4392,
      latitudeDelta: 0.05,
      longitudeDelta: 0.04,
    },
    route: [
      { latitude: 6.4385, longitude: 3.4512 },
      { latitude: 6.4412, longitude: 3.4469 },
      { latitude: 6.4446, longitude: 3.4414 },
      { latitude: 6.4492, longitude: 3.4358 },
      { latitude: 6.4531, longitude: 3.4289 },
    ],
    primaryMarker: { latitude: 6.4385, longitude: 3.4512 },
    secondaryMarker: { latitude: 6.4531, longitude: 3.4289 },
  },
  driverFound: {
    id: 'driver-found',
    region: {
      latitude: 6.4404,
      longitude: 3.4466,
      latitudeDelta: 0.04,
      longitudeDelta: 0.035,
    },
    route: [
      { latitude: 6.4322, longitude: 3.4599 },
      { latitude: 6.4358, longitude: 3.4555 },
      { latitude: 6.4388, longitude: 3.4518 },
      { latitude: 6.4404, longitude: 3.4466 },
    ],
    primaryMarker: { latitude: 6.4322, longitude: 3.4599 },
    secondaryMarker: { latitude: 6.4404, longitude: 3.4466 },
  },
  riderTrip: {
    id: 'rider-trip',
    region: {
      latitude: 6.442,
      longitude: 3.4305,
      latitudeDelta: 0.055,
      longitudeDelta: 0.045,
    },
    route: [
      { latitude: 6.4356, longitude: 3.4554 },
      { latitude: 6.4378, longitude: 3.4492 },
      { latitude: 6.4402, longitude: 3.4446 },
      { latitude: 6.4436, longitude: 3.4388 },
      { latitude: 6.4475, longitude: 3.4325 },
      { latitude: 6.4511, longitude: 3.4251 },
    ],
    primaryMarker: { latitude: 6.4356, longitude: 3.4554 },
    secondaryMarker: { latitude: 6.4511, longitude: 3.4251 },
  },
  driverDashboard: {
    id: 'driver-dashboard',
    region: {
      latitude: 6.4478,
      longitude: 3.4401,
      latitudeDelta: 0.05,
      longitudeDelta: 0.04,
    },
    pulseMarker: { latitude: 6.4478, longitude: 3.4401 },
  },
  driverNavigation: {
    id: 'driver-navigation',
    region: {
      latitude: 6.4398,
      longitude: 3.4485,
      latitudeDelta: 0.045,
      longitudeDelta: 0.035,
    },
    route: [
      { latitude: 6.4308, longitude: 3.4631 },
      { latitude: 6.4336, longitude: 3.4584 },
      { latitude: 6.4365, longitude: 3.4542 },
      { latitude: 6.4391, longitude: 3.4501 },
      { latitude: 6.4419, longitude: 3.4463 },
    ],
    primaryMarker: { latitude: 6.4308, longitude: 3.4631 },
    secondaryMarker: { latitude: 6.4419, longitude: 3.4463 },
  },
  driverActive: {
    id: 'driver-active',
    region: {
      latitude: 6.4472,
      longitude: 3.4319,
      latitudeDelta: 0.055,
      longitudeDelta: 0.045,
    },
    route: [
      { latitude: 6.4419, longitude: 3.4463 },
      { latitude: 6.4446, longitude: 3.4415 },
      { latitude: 6.4478, longitude: 3.4378 },
      { latitude: 6.4501, longitude: 3.4332 },
      { latitude: 6.4528, longitude: 3.4275 },
    ],
    primaryMarker: { latitude: 6.4419, longitude: 3.4463 },
    secondaryMarker: { latitude: 6.4528, longitude: 3.4275 },
  },
} as const satisfies Record<string, MapScene>;

export const driverWalletOverview = {
  availableBalance: '$42.80',
  pendingPayouts: '$6.20',
  lifetimeEarnings: '$318.40',
  instantCashout: 'Available',
  activity: [
    {
      id: 'ride-payout',
      title: 'Ride payout',
      timestamp: 'Today, 5:40 PM',
      amount: '+$3.11',
      direction: 'credit',
    },
    {
      id: 'cashout',
      title: 'Instant cashout',
      timestamp: 'Yesterday, 9:15 PM',
      amount: '-$12.00',
      direction: 'debit',
    },
    {
      id: 'bonus',
      title: 'Driver bonus',
      timestamp: 'Yesterday',
      amount: '+$4.50',
      direction: 'credit',
    },
  ] satisfies DriverWalletEntry[],
} as const;
