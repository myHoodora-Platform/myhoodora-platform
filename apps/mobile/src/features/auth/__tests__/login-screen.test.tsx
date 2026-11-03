import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { LoginScreen } from "../login-screen";

const mockSignIn = jest.fn();
jest.mock("../auth-api", () => ({ signIn: (...args: unknown[]) => mockSignIn(...args) }));
jest.mock("expo-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  useRouter: () => ({ canGoBack: () => true, back: jest.fn() }),
}));

beforeEach(() => mockSignIn.mockReset());

describe("LoginScreen", () => {
  it("checks the form with the web's rules before calling Firebase", async () => {
    await render(<LoginScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Email is required")).toBeTruthy();
    expect(screen.getByText("Password is required")).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("passes the email and password to sign-in (auth-api trims the email)", async () => {
    mockSignIn.mockResolvedValue(undefined);
    await render(<LoginScreen />);
    await fireEvent.changeText(screen.getByLabelText("Email address"), "  ada@example.com ");
    await fireEvent.changeText(screen.getByLabelText("Password"), "secret-123");
    await fireEvent.press(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith("  ada@example.com ", "secret-123"));
  });

  it("shows Firebase's refusal in the web's wording", async () => {
    mockSignIn.mockRejectedValue({ code: "auth/invalid-credential", message: "Firebase: Error" });
    await render(<LoginScreen />);
    await fireEvent.changeText(screen.getByLabelText("Email address"), "ada@example.com");
    await fireEvent.changeText(screen.getByLabelText("Password"), "wrong");
    await fireEvent.press(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Incorrect email or password.")).toBeTruthy();
  });
});
