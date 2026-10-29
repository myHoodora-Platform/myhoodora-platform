import * as Sentry from "@sentry/react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import { Text } from "react-native";
import { CrashScreen } from "../crash-screen";

let shouldThrow = true;
function Flaky() {
  if (shouldThrow) throw new Error("render failed");
  return <Text>App content</Text>;
}

function Harness() {
  const [restarts, setRestarts] = useState(0);
  return (
    <Sentry.ErrorBoundary key={restarts} fallback={({ resetError }) => <CrashScreen onRestart={() => (resetError(), setRestarts((n) => n + 1))} />}>
      <Flaky />
    </Sentry.ErrorBoundary>
  );
}

describe("CrashScreen inside the root error boundary", () => {
  beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it("shows a calm message instead of a white screen, and Restart brings the app back", async () => {
    shouldThrow = true;
    await render(<Harness />);
    expect(screen.getByText("Something went wrong")).toBeTruthy();
    expect(screen.queryByText("App content")).toBeNull();

    shouldThrow = false;
    await fireEvent.press(screen.getByRole("button", { name: "Restart" }));
    expect(await screen.findByText("App content")).toBeTruthy();
  });
});
