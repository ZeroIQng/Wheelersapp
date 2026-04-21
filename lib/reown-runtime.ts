import * as reownEthersRuntimeModule from '@reown/appkit-ethers-react-native/lib/commonjs/index.js';
import * as reownRuntimeModule from '@reown/appkit-react-native/lib/commonjs/index.js';

type ReownRuntime = Pick<
  typeof import('@reown/appkit-react-native'),
  'AppKit' | 'AppKitButton' | 'AppKitProvider' | 'createAppKit' | 'useAccount'
>;
type ReownEthersRuntime = Pick<typeof import('@reown/appkit-ethers-react-native'), 'EthersAdapter'>;

const reownRuntime = reownRuntimeModule as ReownRuntime;
const reownEthersRuntime = reownEthersRuntimeModule as ReownEthersRuntime;

export const { AppKit, AppKitButton, AppKitProvider, createAppKit, useAccount } = reownRuntime;
export const { EthersAdapter } = reownEthersRuntime;

export type { AppKitNetwork, Storage } from '@reown/appkit-react-native';
