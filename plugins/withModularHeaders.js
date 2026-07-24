const { withPodfile } = require("expo/config-plugins");

module.exports = function withModularHeaders(config) {
  return withPodfile(config, (config) => {
    const podfile = config.modResults.contents;

    // Add modular headers for pods that AppCheckCore (from Google Sign-In) depends on
    const modularHeadersPatch = `
# Fix: AppCheckCore requires modular headers for these dependencies
pod 'GoogleUtilities', :modular_headers => true
pod 'RecaptchaInterop', :modular_headers => true
`;

    if (!podfile.includes("GoogleUtilities', :modular_headers")) {
      // Insert before the first "end" that closes the target block
      config.modResults.contents = podfile.replace(
        /use_expo_modules!/,
        `use_expo_modules!\n${modularHeadersPatch}`
      );
    }

    return config;
  });
};
