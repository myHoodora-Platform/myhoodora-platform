import { act, fireEvent, render, screen } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { RegisterScreen } from "../register-screen";

const mockSignUp = jest.fn();
jest.mock("../auth-api", () => ({ signUp: (...args: unknown[]) => mockSignUp(...args), signInWithGoogle: jest.fn(), GoogleSignInUnavailable: class extends Error {} }));
jest.mock("expo-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  useRouter: () => ({ canGoBack: () => true, back: jest.fn(), replace: jest.fn() }),
}));

// The real sheet is a WebView of the website; here its "I agree" stands for having read both to the end.
jest.mock("@/features/legal/policy-review-modal", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    PolicyReviewModal: ({ visible, onAgree }: { visible: boolean; onAgree: () => void }) =>
      visible ? (
        <Pressable accessibilityRole="button" onPress={onAgree}>
          <Text>Read both: I agree</Text>
        </Pressable>
      ) : null,
  };
});

beforeEach(async () => {
  mockSignUp.mockReset();
  // The under-18 test locks this "phone" for 30 days.
  await AsyncStorage.clear();
});

async function fill(year = "1990") {
  await render(<RegisterScreen />);
  await fireEvent.changeText(screen.getByLabelText("Email address"), "ada@example.com");
  await fireEvent.changeText(screen.getByLabelText("Create a password"), "neighbour-123");
  await fireEvent.changeText(screen.getByLabelText("Confirm password"), "neighbour-123");
  await fireEvent.changeText(screen.getByLabelText("Year you were born"), year);
  await fireEvent(screen.getByLabelText("I agree to the Terms of Use and Privacy Policy"), "valueChange", true);
  await fireEvent.press(screen.getByText("Read both: I agree"));
}

describe("RegisterScreen", () => {
  it("turns on \"I agree\" only from the policy sheet, after reading", async () => {
    await render(<RegisterScreen />);
    const agree = screen.getByLabelText("I agree to the Terms of Use and Privacy Policy");
    await fireEvent(agree, "valueChange", true);
    expect(agree.props.value).toBe(false);
    await fireEvent.press(screen.getByText("Read both: I agree"));
    expect(screen.getByLabelText("I agree to the Terms of Use and Privacy Policy").props.value).toBe(true);
    expect(screen.queryByText("Read both: I agree")).toBeNull();
  });

  it("asks Firebase once, however fast it is submitted", async () => {
    let finish!: () => void;
    mockSignUp.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    await fill();
    // Two submits (the keyboard's "done" twice) land before React re-renders the button as busy.
    const { onSubmitEditing } = screen.getByLabelText("Year you were born").props as { onSubmitEditing: () => Promise<void> };
    await act(async () => {
      const first = onSubmitEditing();
      const second = onSubmitEditing();
      finish();
      await Promise.all([first, second]);
    });
    expect(mockSignUp).toHaveBeenCalledTimes(1);
  });

  it("catches a mistyped confirmation before any request", async () => {
    await fill();
    await fireEvent.changeText(screen.getByLabelText("Confirm password"), "neighbour-124");
    await fireEvent.press(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Passwords don't match.")).toBeTruthy();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("asks the year, and makes no account at all for an answer under 18", async () => {
    await fill(String(new Date().getFullYear() - 12));
    await fireEvent.press(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Sorry, you can't join myHoodora yet")).toBeTruthy();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("asks the day and month only for the year that turns 18 now", async () => {
    mockSignUp.mockResolvedValue(undefined);
    await fill(String(new Date().getFullYear() - 18));
    expect(screen.getByLabelText("Day")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Add the day and month you were born too.")).toBeTruthy();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("keeps what was typed and shows Firebase's refusal in the web's wording", async () => {
    mockSignUp.mockRejectedValue({ code: "auth/email-already-in-use", message: "Firebase: Error" });
    await fill();
    await fireEvent.press(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("An account with this email already exists.")).toBeTruthy();
    expect(screen.queryByText("You must agree to the Terms of Use and Privacy Policy")).toBeNull();
    expect(screen.getByLabelText("Email address").props.value).toBe("ada@example.com");
  });
});
