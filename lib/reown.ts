import "@walletconnect/react-native-compat";
import "react-native-get-random-values";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { mainnet } from "viem/chains";

import { EthersAdapter, createAppKit } from "@/lib/reown-runtime";
import type { AppKitNetwork, Storage } from "@reown/appkit-react-native";

const projectId = process.env.EXPO_PUBLIC_REOWN_PROJECT_ID;
export const walletConnectProjectIdEnvVar = "EXPO_PUBLIC_REOWN_PROJECT_ID";
const storagePrefix = "wheelers:reown:";
const volatileRestorePrefixes = ["wc@"] as const;
const volatileAppKitRestoreKeys = new Set([
  "@appkit/active_namespace",
  "@appkit/connected_connectors",
]);

const metadata = {
  name: "Wheleers",
  description: "Decentralized ride-hailing onboarding for riders and drivers.",
  url: "https://wheleers.app",
  icons: ["https://wheleers.app/icon.png"],
  redirect: {
    native: "wheelersapp://",
  },
};

const ethereumNetwork: AppKitNetwork = {
  ...mainnet,
  chainNamespace: "eip155",
  caipNetworkId: "eip155:1",
};

const storage: Storage = {
  async getKeys() {
    const keys = await AsyncStorage.getAllKeys();
    return keys
      .filter((key) => key.startsWith(storagePrefix))
      .map((key) => key.slice(storagePrefix.length))
      .filter((key) => !shouldSkipRestore(key));
  },
  async getEntries<T = unknown>() {
    const keys = await storage.getKeys();
    const entries = await AsyncStorage.multiGet(keys.map(createStorageKey));
    return entries.map(
      ([key, value]) =>
        [stripStoragePrefix(key), parseStoredValue<T>(value)] as [string, T],
    );
  },
  async getItem<T = unknown>(key: string) {
    if (shouldSkipRestore(key)) {
      return undefined;
    }
    const value = await AsyncStorage.getItem(createStorageKey(key));
    return parseStoredValue<T>(value);
  },
  async setItem<T = unknown>(key: string, value: T) {
    await AsyncStorage.setItem(createStorageKey(key), JSON.stringify(value));
  },
  async removeItem(key: string) {
    await AsyncStorage.removeItem(createStorageKey(key));
  },
};

function createStorageKey(key: string) {
  return `${storagePrefix}${key}`;
}

function stripStoragePrefix(key: string) {
  return key.startsWith(storagePrefix) ? key.slice(storagePrefix.length) : key;
}

function shouldSkipRestore(key: string) {
  return (
    volatileAppKitRestoreKeys.has(key) ||
    volatileRestorePrefixes.some((prefix) => key.startsWith(prefix))
  );
}

function parseStoredValue<T>(value: string | null): T | undefined {
  if (value == null) return undefined;
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
      themeMode: "light",
      themeVariables: {
        accent: "#FF5C00",
      },
      enableAnalytics: false,
      features: {
        onramp: false,
        swaps: false,
        socials: false,
        showWallets: true,
      },
    })
  : null;
