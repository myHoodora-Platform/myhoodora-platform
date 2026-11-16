import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Linking from "expo-linking";
import { AppUpdatePrompts } from "../app-update-prompts";

const play = "https://play.google.com/store/apps/details?id=com.myhoodora.app";
const mockConfig = jest.fn();
const mockOta = { ready: false, restart: jest.fn() };

jest.mock("@/features/account/account-api", () => ({ accountKeys: { appConfig: ["app-config"] }, getAppConfig: () => mockConfig() }));
jest.mock("@/core/updates/ota-update", () => ({ useOtaUpdate: () => mockOta }));
jest.mock("expo-application", () => ({ nativeApplicationVersion: "1.0.0" }));
jest.mock("expo-linking", () => ({ openURL: jest.fn(() => Promise.resolve()) }));
jest.mock("@react-native-async-storage/async-storage", () => ({ getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) }));
jest.mock("react-native-reanimated", () => {
  const { View } = jest.requireActual("react-native");
  return { __esModule: true, default: { View }, useAnimatedStyle: () => ({}) };
});
jest.mock("@/shared/hooks/use-keyboard-height", () => ({ useKeyboardHeight: () => ({ get: () => 0 }) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const config = (latest: string, minimum: string) => ({
  analytics: { reaskDays: 180 },
  links: { hoodoraAiStudio: null },
  updates: { android: { latest, minimum, storeUrl: play }, ios: { latest, minimum, storeUrl: play } },
});

async function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={client}>
      <AppUpdatePrompts />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOta.ready = false;
});

describe("AppUpdatePrompts", () => {
  it("blocks a version below the minimum with only the way to the store", async () => {
    mockConfig.mockResolvedValue(config("1.2.0", "1.1.0"));
    await setup();
    fireEvent.press(await screen.findByText("Update now"));
    expect(screen.getByText("Time to update")).toBeTruthy();
    expect(Linking.openURL).toHaveBeenCalledWith(play);
  });

  it("offers a newer store version in a sheet that can be skipped", async () => {
    mockConfig.mockResolvedValue(config("1.1.0", "1.0.0"));
    await setup();
    expect(await screen.findByText("A new version of myHoodora")).toBeTruthy();
    expect(screen.queryByText("Time to update")).toBeNull();
    fireEvent.press(screen.getByText("Cancel"));
    await waitFor(() => expect(screen.queryByText("A new version of myHoodora")).toBeNull());
  });

  it("says nothing when the app is up to date, and offers a restart once an over-the-air update is ready", async () => {
    mockConfig.mockResolvedValue(config("1.0.0", "1.0.0"));
    mockOta.ready = true;
    await setup();
    fireEvent.press(await screen.findByText("Restart"));
    expect(mockOta.restart).toHaveBeenCalled();
    expect(screen.queryByText("A new version of myHoodora")).toBeNull();
    expect(screen.queryByText("Time to update")).toBeNull();
  });
});
