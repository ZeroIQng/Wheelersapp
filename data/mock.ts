export const walletBalance = '$28.50';

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
  initials: 'AK',
  name: 'Emeka O.',
  rating: '4.9',
  vehicle: 'Toyota Corolla',
  plate: 'ABJ-234KL',
  etaMinutes: 2,
  fare: '$1.85',
  tripMinutes: 18,
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
