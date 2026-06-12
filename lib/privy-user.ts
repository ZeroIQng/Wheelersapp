import type { LinkedAccount, User } from "@privy-io/expo";

function isGoogleAccount(account: LinkedAccount): account is Extract<LinkedAccount, { type: "google_oauth" }> {
  return account.type === "google_oauth";
}

function isPrivyEthereumWallet(
  account: LinkedAccount
): account is Extract<
  LinkedAccount,
  {
    type: "wallet";
    chain_type: "ethereum";
    wallet_client_type: "privy";
  }
> {
  return (
    account.type === "wallet" &&
    "chain_type" in account &&
    account.chain_type === "ethereum" &&
    "wallet_client_type" in account &&
    account.wallet_client_type === "privy"
  );
}

type MaybePrivyUser = User | null | undefined;

function getLinkedAccounts(user: MaybePrivyUser): LinkedAccount[] {
  return Array.isArray(user?.linked_accounts) ? user.linked_accounts : [];
}

export function getPrivyEmail(user: MaybePrivyUser): string | undefined {
  const googleAccount = getLinkedAccounts(user).find(isGoogleAccount);
  return googleAccount?.email ?? undefined;
}

export function getPrivyName(user: MaybePrivyUser): string | undefined {
  const googleAccount = getLinkedAccounts(user).find(isGoogleAccount);
  return googleAccount?.name ?? undefined;
}

export function getPrivyEthereumWalletAddress(user: MaybePrivyUser): string | undefined {
  const embeddedWallet = getLinkedAccounts(user).find(isPrivyEthereumWallet);
  return embeddedWallet?.address?.toLowerCase();
}
