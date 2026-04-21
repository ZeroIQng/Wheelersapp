import Constants from "expo-constants";
import type { ComponentProps, PropsWithChildren } from "react";

type ThirdwebReactModule = typeof import("thirdweb/react");

export const isExpoGo =
  Constants.appOwnership === "expo" ||
  Constants.executionEnvironment === "storeClient";

export const isThirdwebRuntimeAvailable = !isExpoGo;

const thirdwebReact: ThirdwebReactModule | null = isThirdwebRuntimeAvailable
  ? (require("thirdweb/react") as ThirdwebReactModule)
  : null;

export function ThirdwebProvider({ children }: PropsWithChildren) {
  if (!thirdwebReact) {
    return children;
  }

  const Provider = thirdwebReact.ThirdwebProvider;
  return <Provider>{children}</Provider>;
}

export function ConnectButton(
  props: ComponentProps<ThirdwebReactModule["ConnectButton"]>,
) {
  if (!thirdwebReact) {
    return null;
  }

  const Button = thirdwebReact.ConnectButton;
  return <Button {...props} />;
}

export function useActiveAccount() {
  if (!thirdwebReact) {
    return undefined;
  }

  return thirdwebReact.useActiveAccount();
}

export function useActiveWalletChain() {
  if (!thirdwebReact) {
    return null;
  }

  return thirdwebReact.useActiveWalletChain();
}
