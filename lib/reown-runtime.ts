type ReownRuntime = Pick<
  typeof import('@reown/appkit-react-native'),
  'AppKit' | 'AppKitButton' | 'AppKitProvider' | 'createAppKit' | 'useAccount'
>;
type ReownEthersRuntime = Pick<typeof import('@reown/appkit-ethers-react-native'), 'EthersAdapter'>;

const reownRuntime = require('@reown/appkit-react-native/lib/commonjs/index.js') as ReownRuntime;
const reownEthersRuntime = require('@reown/appkit-ethers-react-native/lib/commonjs/index.js') as ReownEthersRuntime;

export const { AppKit, AppKitButton, AppKitProvider, createAppKit, useAccount } = reownRuntime;
export const { EthersAdapter } = reownEthersRuntime;

export type { AppKitNetwork, Storage } from '@reown/appkit-react-native';
