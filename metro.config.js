const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  "@reown/appkit-react-native": path.join(
    __dirname,
    "node_modules/@reown/appkit-react-native/lib/commonjs",
  ),
  "@reown/appkit-ethers-react-native": path.join(
    __dirname,
    "node_modules/@reown/appkit-ethers-react-native/lib/commonjs",
  ),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "jose") {
    return {
      filePath: path.join(__dirname, "node_modules/jose/dist/browser/index.js"),
      type: "sourceFile",
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.unstable_enablePackageExports = false;

module.exports = config;
