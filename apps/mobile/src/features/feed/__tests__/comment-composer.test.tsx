import { ApiError } from "@myhoodora/api-contract/errors";
import type { ApiPost, Comment } from "@myhoodora/api-contract/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { CommentComposer } from "../comment-composer";

const mockAdd = jest.fn();
let mockProfile: Record<string, unknown> = { displayName: "Ada Okafor", emailVerified: true };
jest.mock("@/core/auth/auth-provider", () => ({ useSignedInUser: () => ({ uid: "u1" }), useAuth: () => ({ profile: mockProfile }) }));
jest.mock("@/shared/ui/toast", () => ({ useToast: () => jest.fn() }));
jest.mock("@/core/preferences/appearance", () => ({ useAppearance: () => ({ surface: "plain" }) }));
jest.mock("../feed-api", () => ({
  addComment: (...a: unknown[]) => mockAdd(...a),
  resendVerificationEmail: jest.fn(),
  feedKeys: { all: ["feed"], post: (id: string) => ["post", id], comments: (id: string) => ["post", id, "comments"] },
}));

const post = { _id: "p1", commentCount: 0 } as ApiPost;

const clients: QueryClient[] = [];
afterEach(() => clients.splice(0).forEach((c) => c.clear()));

async function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  clients.push(client);
  client.setQueryData<Comment[]>(["post", "p1", "comments"], []);
  await render(
    <QueryClientProvider client={client}>
      <CommentComposer post={post} />
    </QueryClientProvider>,
  );
  return client;
}

beforeEach(() => {
  mockAdd.mockReset();
  mockProfile = { displayName: "Ada Okafor", emailVerified: true };
});

describe("CommentComposer", () => {
  it("shows the comment at once, before the API answers", async () => {
    let seen: Comment[] | undefined;
    mockAdd.mockImplementation(async () => {
      // What the list holds while the request is still out.
      seen = client.getQueryData<Comment[]>(["post", "p1", "comments"]);
      return {};
    });
    const client = await setup();
    await fireEvent.changeText(screen.getByLabelText("Add a comment"), "I'll keep an eye out.");
    await fireEvent.press(screen.getByRole("button", { name: "Post comment" }));
    await waitFor(() => expect(mockAdd).toHaveBeenCalled());
    expect(seen).toHaveLength(1);
    expect(seen![0]!._id).toMatch(/^pending-/);
  });

  it("if the API refuses, takes it back and returns the words to the box with the reason", async () => {
    mockAdd.mockRejectedValue(new ApiError("Slow down a little.", 429, "rate_limited"));
    const client = await setup();
    await fireEvent.changeText(screen.getByLabelText("Add a comment"), "I'll keep an eye out.");
    await fireEvent.press(screen.getByRole("button", { name: "Post comment" }));
    expect(await screen.findByText(/Your comment wasn't posted/)).toBeTruthy();
    expect(screen.getByLabelText("Add a comment").props.value).toBe("I'll keep an eye out.");
    expect(client.getQueryData<Comment[]>(["post", "p1", "comments"])).toEqual([]);
  });

  it("without a confirmed email, says so instead of offering a box the API would refuse", async () => {
    mockProfile = { displayName: "Ada", emailVerified: false };
    await setup();
    expect(await screen.findByText("Confirm your email to join the conversation.")).toBeTruthy();
    expect(screen.queryByLabelText("Add a comment")).toBeNull();
  });
});
