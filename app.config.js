const appJson = require("./app.json");

const rawVariant =
  process.env.APP_VARIANT?.trim() ||
  process.env.EXPO_PUBLIC_APP_VARIANT?.trim() ||
  "rider";
const appVariant = rawVariant === "driver" ? "driver" : "rider";
const isDriverApp = appVariant === "driver";

const googleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
  process.env.GOOGLE_MAPS_API_KEY?.trim() ||
  undefined;

module.exports = () => ({
  ...appJson,
  expo: {
    ...appJson.expo,
    name: isDriverApp ? "Wheelers Driver" : "Wheelers",
    slug: "wheelers",
    scheme: isDriverApp ? "wheelersdriver" : "wheelersapp",
    extra: {
      ...appJson.expo.extra,
      appVariant,
      googleMapsApiKey,
    },
    ios: {
      ...appJson.expo.ios,
      bundleIdentifier: isDriverApp
        ? "com.timmy133.wheelers.driver"
        : "com.timmy133.wheelers",
      config: {
        ...appJson.expo.ios?.config,
        googleMapsApiKey,
      },
    },
    android: {
      ...appJson.expo.android,
      package: isDriverApp
        ? "com.timmy133.wheelers.driver"
        : "com.timmy133.wheelers",
      config: {
        ...appJson.expo.android?.config,
        googleMaps: googleMapsApiKey
          ? {
              apiKey: googleMapsApiKey,
            }
          : undefined,
      },
    },
  },
});
