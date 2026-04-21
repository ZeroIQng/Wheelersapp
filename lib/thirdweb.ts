import { createThirdwebClient, type ThirdwebClient } from "thirdweb";
import { ethereum } from "thirdweb/chains";
import { createWallet } from "thirdweb/wallets";

const thirdwebClientId = process.env.EXPO_PUBLIC_THIRDWEB_CLIENT_ID;

export const thirdwebClientIdEnvVar = "EXPO_PUBLIC_THIRDWEB_CLIENT_ID";
export const isThirdwebConfigured = Boolean(thirdwebClientId);

export const thirdwebAppMetadata = {
  name: "Wheleers",
  url: "https://wheleers.app",
  description: "Decentralized ride-hailing onboarding for riders and drivers.",
  logoUrl: "https://wheleers.app/icon.png",
};

export const thirdwebChain = ethereum;

export const thirdwebClient: ThirdwebClient | null = thirdwebClientId
  ? createThirdwebClient({
      clientId: thirdwebClientId,
    })
  : null;

export const thirdwebWallets = [
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet", {
    appMetadata: thirdwebAppMetadata,
    chains: [thirdwebChain],
    mobileConfig: {
      callbackURL: "wheelersapp://",
    },
  }),
  createWallet("me.rainbow"),
];
