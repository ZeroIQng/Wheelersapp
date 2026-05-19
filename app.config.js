const appJson = require("./app.json");

const googleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
  process.env.GOOGLE_MAPS_API_KEY?.trim() ||
  undefined;

module.exports = () => ({
  ...appJson,
  expo: {
    ...appJson.expo,
    extra: {
      ...appJson.expo.extra,
      googleMapsApiKey,
    },
    ios: {
      ...appJson.expo.ios,
      config: {
        ...appJson.expo.ios?.config,
        googleMapsApiKey,
      },
    },
    android: {
      ...appJson.expo.android,
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
