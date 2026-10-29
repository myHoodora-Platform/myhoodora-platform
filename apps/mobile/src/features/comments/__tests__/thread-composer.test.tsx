import type { ApiPost } from "@myhoodora/api-contract/types";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { commentDrafts } from "../comment-drafts";
import { ThreadComposer } from "../thread-composer";

let mockProfile: Record<string, unknown> = {};
jest.mock("@/core/auth/auth-provider", () => ({ useSignedInUser: () => ({ uid: "u1" }), useAuth: () => ({ profile: mockProfile }) }));
jest.mock("@/shared/ui/toast", () => ({ useToast: () => jest.fn() }));
jest.mock("@/features/feed/feed-api", () => ({ resendVerificationEmail: jest.fn() }));

const post = { _id: "p1", neighborhoodId: "h1" } as ApiPost;

beforeEach(() => {
  mockProfile = { displayName: "Ada Okafor", neighborhoodId: "h1", emailVerified: true };
  commentDrafts.clear("p1");
});

describe("ThreadComposer", () => {
  it("sends, then empties the box and forgets the draft", async () => {
    const send = jest.fn(() => true);
    await render(<ThreadComposer post={post} onCancelReply={jest.fn()} send={send} />);
    await fireEvent.changeText(screen.getByLabelText("Write a comment"), "I'll keep an eye out.");
    await fireEvent.press(screen.getByRole("button", { name: "Send comment" }));
    expect(send).toHaveBeenCalledWith("I'll keep an eye out.", undefined);
    expect(screen.getByLabelText("Write a comment").props.value).toBe("");
    expect(commentDrafts.get("p1").text).toBe("");
  });

  it("keeps the words when nothing was sent (one already on its way)", async () => {
    await render(<ThreadComposer post={post} onCancelReply={jest.fn()} send={() => false} />);
    await fireEvent.changeText(screen.getByLabelText("Write a comment"), "Again");
    await fireEvent.press(screen.getByRole("button", { name: "Send comment" }));
    expect(screen.getByLabelText("Write a comment").props.value).toBe("Again");
  });

  it("without a confirmed email, says so instead of offering a box the API would refuse", async () => {
    mockProfile = { displayName: "Ada", neighborhoodId: "h1", emailVerified: false };
    await render(<ThreadComposer post={post} onCancelReply={jest.fn()} send={jest.fn()} />);
    expect(await screen.findByText("Confirm your email to join the conversation.")).toBeTruthy();
    expect(screen.queryByLabelText("Write a comment")).toBeNull();
  });

  it("in a neighbourhood you only follow, you can read but not comment", async () => {
    mockProfile = { displayName: "Ada", neighborhoodId: "elsewhere", emailVerified: true };
    await render(<ThreadComposer post={post} onCancelReply={jest.fn()} send={jest.fn()} />);
    expect(screen.getByText(/you can read along/)).toBeTruthy();
    expect(screen.queryByLabelText("Write a comment")).toBeNull();
  });
});
