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

export function getPrivyEmail(user: User): string | undefined {
  const googleAccount = user.linked_accounts.find(isGoogleAccount);
  return googleAccount?.email ?? undefined;
}

export function getPrivyName(user: User): string | undefined {
  const googleAccount = user.linked_accounts.find(isGoogleAccount);
  return googleAccount?.name ?? undefined;
}

export function getPrivyEthereumWalletAddress(user: User): string | undefined {
  const embeddedWallet = user.linked_accounts.find(isPrivyEthereumWallet);
  return embeddedWallet?.address?.toLowerCase();
}
