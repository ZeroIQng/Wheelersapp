import '@walletconnect/react-native-compat';
import 'react-native-get-random-values';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { EthersAdapter } from '@reown/appkit-ethers-react-native';
import { AppKitNetwork, Storage, createAppKit } from '@reown/appkit-react-native';
import { mainnet } from 'viem/chains';

const projectId = process.env.EXPO_PUBLIC_REOWN_PROJECT_ID;
export const walletConnectProjectIdEnvVar = 'EXPO_PUBLIC_REOWN_PROJECT_ID';

const metadata = {
  name: 'Wheleers',
  description: 'Decentralized ride-hailing onboarding for riders and drivers.',
  url: 'https://wheleers.app',
  icons: ['https://wheleers.app/icon.png'],
  redirect: {
    native: 'wheelersapp://',
  },
};

const ethereumNetwork: AppKitNetwork = {
  ...mainnet,
  chainNamespace: 'eip155',
  caipNetworkId: 'eip155:1',
};

const storage: Storage = {
  async getKeys() {
    return [...(await AsyncStorage.getAllKeys())];
  },
  async getEntries<T = unknown>() {
    const keys = await AsyncStorage.getAllKeys();
    const entries = await AsyncStorage.multiGet(keys);

    return entries.map(([key, value]) => [key, parseStoredValue<T>(value)] as [string, T]);
  },
  async getItem<T = unknown>(key: string) {
    const value = await AsyncStorage.getItem(key);
    return parseStoredValue<T>(value);
  },
  async setItem<T = unknown>(key: string, value: T) {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
  },
};

function parseStoredValue<T>(value: string | null): T | undefined {
  if (value == null) {
    return undefined;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
}

export const isWalletConnectConfigured = Boolean(projectId);

export const appKit = projectId
  ? createAppKit({
      projectId,
      metadata,
      networks: [ethereumNetwork],
      defaultNetwork: ethereumNetwork,
      adapters: [new EthersAdapter()],
      storage,
      themeMode: 'light',
      themeVariables: {
        accent: '#FF5C00',
      },
      enableAnalytics: false,
      features: { onramp: false, swaps: false, socials: false, showWallets: true },
    })
  : null;
