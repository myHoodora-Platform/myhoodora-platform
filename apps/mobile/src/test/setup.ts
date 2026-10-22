// Native modules have no implementation under Jest; these are their maintainers' official mocks.
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);
jest.mock("@react-native-community/netinfo", () => require("@react-native-community/netinfo/jest/netinfo-mock.js"));

// Tests never read the real EXPO_PUBLIC_* values.
process.env.EXPO_PUBLIC_API_URL = "https://api.test/api";
process.env.EXPO_PUBLIC_WEB_URL = "https://web.test";
process.env.EXPO_PUBLIC_FIREBASE_API_KEY = "test-key";
process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN = "test.firebaseapp.com";
process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = "test";
process.env.EXPO_PUBLIC_FIREBASE_APP_ID = "1:1:ios:1";
