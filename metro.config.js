const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "crypto") {
    return context.resolveRequest(
      context,
      "react-native-quick-crypto",
      platform,
    );
  }

  if (moduleName === "jose") {
    return {
      filePath: require("path").join(
        __dirname,
        "node_modules/jose/dist/browser/index.js",
      ),
      type: "sourceFile",
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ["react-native", "browser", "require"];

module.exports = config;
