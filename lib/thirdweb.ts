import Constants from "expo-constants";
import type { ThirdwebClient } from "thirdweb";

const isExpoGo =
  Constants.appOwnership === "expo" ||
  Constants.executionEnvironment === "storeClient";

const thirdwebClientId = process.env.EXPO_PUBLIC_THIRDWEB_CLIENT_ID;

export const thirdwebClientIdEnvVar = "EXPO_PUBLIC_THIRDWEB_CLIENT_ID";
export const isThirdwebConfigured = Boolean(thirdwebClientId);
export const isThirdwebSdkAvailable = !isExpoGo;

export const thirdwebAppMetadata = {
  name: "Wheleers",
  url: "https://wheleers.app",
  description: "Decentralized ride-hailing onboarding for riders and drivers.",
  logoUrl: "https://wheleers.app/icon.png",
};

type ThirdwebChainsModule = typeof import("thirdweb/chains");
type ThirdwebWalletsModule = typeof import("thirdweb/wallets");
type ThirdwebModule = typeof import("thirdweb");

const thirdwebModule: ThirdwebModule | null =
  isThirdwebSdkAvailable && thirdwebClientId
    ? (require("thirdweb") as ThirdwebModule)
    : null;
const thirdwebChainsModule: ThirdwebChainsModule | null = isThirdwebSdkAvailable
  ? (require("thirdweb/chains") as ThirdwebChainsModule)
  : null;
const thirdwebWalletsModule: ThirdwebWalletsModule | null = isThirdwebSdkAvailable
  ? (require("thirdweb/wallets") as ThirdwebWalletsModule)
  : null;

export const thirdwebChain = thirdwebChainsModule?.ethereum ?? null;

export const thirdwebClient: ThirdwebClient | null =
  thirdwebModule && thirdwebClientId
    ? thirdwebModule.createThirdwebClient({
        clientId: thirdwebClientId,
      })
    : null;

export const thirdwebWallets =
  thirdwebWalletsModule && thirdwebChain
    ? [
        thirdwebWalletsModule.createWallet("io.metamask"),
        thirdwebWalletsModule.createWallet("com.coinbase.wallet", {
          appMetadata: thirdwebAppMetadata,
          chains: [thirdwebChain],
          mobileConfig: {
            callbackURL: "wheelersapp://",
          },
        }),
        thirdwebWalletsModule.createWallet("me.rainbow"),
      ]
    : [];
