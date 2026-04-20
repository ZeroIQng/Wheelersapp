export const privyAppIdEnvVar = 'EXPO_PUBLIC_PRIVY_APP_ID';
export const privyClientIdEnvVar = 'EXPO_PUBLIC_PRIVY_CLIENT_ID';

export const privyAppId = process.env.EXPO_PUBLIC_PRIVY_APP_ID;
export const privyClientId = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID;
export const privyOAuthRedirectPath = '/role-selection';

export const isPrivyConfigured = Boolean(privyAppId && privyClientId);
