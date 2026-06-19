const { withAppBuildGradle, withProjectBuildGradle } = require('@expo/config-plugins');

/**
 * Adds Google Services Gradle plugin so Firebase initialises correctly.
 * expo-notifications includes the Firebase Messaging SDK but does NOT
 * automatically apply com.google.gms.google-services in bare/generic workflow.
 */
module.exports = (config) => {
  config = withProjectBuildGradle(config, (config) => {
    const contents = config.modResults.contents;
    if (!contents.includes('com.google.gms:google-services')) {
      config.modResults.contents = contents.replace(
        "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')",
        "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')\n    classpath('com.google.gms:google-services:4.4.2')",
      );
    }
    return config;
  });

  config = withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;
    if (!contents.includes('com.google.gms.google-services')) {
      config.modResults.contents = contents.replace(
        'apply plugin: "com.facebook.react"',
        'apply plugin: "com.facebook.react"\napply plugin: "com.google.gms.google-services"',
      );
    }
    return config;
  });

  return config;
};
