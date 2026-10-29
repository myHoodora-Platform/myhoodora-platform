import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { RegisterScreen } from "../register-screen";

const mockSignUp = jest.fn();
jest.mock("../auth-api", () => ({ signUp: (...args: unknown[]) => mockSignUp(...args), signInWithGoogle: jest.fn(), GoogleSignInUnavailable: class extends Error {} }));
jest.mock("expo-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  useRouter: () => ({ canGoBack: () => true, back: jest.fn(), replace: jest.fn() }),
}));

beforeEach(() => mockSignUp.mockReset());

async function fill() {
  await render(<RegisterScreen />);
  await fireEvent.changeText(screen.getByLabelText("Email address"), "ada@example.com");
  await fireEvent.changeText(screen.getByLabelText("Create a password"), "neighbour-123");
  await fireEvent.changeText(screen.getByLabelText("Confirm password"), "neighbour-123");
  await fireEvent(screen.getByLabelText("I agree to the Terms of Use and Privacy Policy"), "valueChange", true);
}

describe("RegisterScreen", () => {
  it("asks Firebase once, however fast it is submitted", async () => {
    let finish!: () => void;
    mockSignUp.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    await fill();
    // Two submits (the keyboard's "done" twice) land before React re-renders the button as busy.
    const { onSubmitEditing } = screen.getByLabelText("Confirm password").props as { onSubmitEditing: () => Promise<void> };
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

  it("keeps what was typed and shows Firebase's refusal in the web's wording", async () => {
    mockSignUp.mockRejectedValue({ code: "auth/email-already-in-use", message: "Firebase: Error" });
    await fill();
    await fireEvent.press(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("An account with this email already exists.")).toBeTruthy();
    expect(screen.queryByText("You must agree to the Terms of Use and Privacy Policy")).toBeNull();
    expect(screen.getByLabelText("Email address").props.value).toBe("ada@example.com");
  });
});
