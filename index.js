require("react-native-get-random-values");

const Constants = require("expo-constants").default;

const isExpoGo =
  Constants.appOwnership === "expo" ||
  Constants.executionEnvironment === "storeClient";

if (!isExpoGo) {
  require("@thirdweb-dev/react-native-adapter");
}

require("expo-router/entry");
