const { withSettingsGradle } = require("expo/config-plugins");

module.exports = function withGradlePluginPortal(config) {
  return withSettingsGradle(config, (config) => {
    if (!config.modResults.contents.includes("gradlePluginPortal()")) {
      config.modResults.contents = config.modResults.contents.replace(
        "pluginManagement {",
        `pluginManagement {
  repositories {
    mavenCentral()
    google()
    gradlePluginPortal()
  }`
      );
    }
    return config;
  });
};
