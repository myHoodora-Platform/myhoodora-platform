import { renderHook } from "@testing-library/react-native";
import { useOpenProfile } from "../use-open-profile";

const mockPush = jest.fn();
jest.mock("@/core/auth/auth-provider", () => ({ useSignedInUser: () => ({ uid: "me" }) }));
jest.mock("@/core/navigation/use-router", () => ({ useRouter: () => ({ push: mockPush }) }));

beforeEach(() => mockPush.mockReset());

describe("useOpenProfile", () => {
  it("opens a neighbour's profile, your own for you, and nothing for a departed author", async () => {
    const { result } = await renderHook(() => useOpenProfile());
    result.current("ada");
    result.current("me");
    result.current(undefined);
    result.current("");
    expect(mockPush.mock.calls).toEqual([["/u/ada"], ["/more"]]);
  });
});
