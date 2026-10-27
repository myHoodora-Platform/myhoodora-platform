import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { useSendComment } from "../use-send-comment";

const mockAdd = jest.fn();
jest.mock("@/core/auth/auth-provider", () => ({ useSignedInUser: () => ({ uid: "u1" }) }));
jest.mock("@/features/feed/feed-api", () => ({
  addComment: (...a: unknown[]) => mockAdd(...a),
  feedKeys: {
    all: ["feed"],
    post: (id: string) => ["post", id],
    comments: (id: string) => ["post", id, "comments"],
    replies: (id: string, p: string) => ["post", id, "comments", "replies", p],
  },
}));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => useSendComment({ _id: "p1" }), { wrapper });
}

/** A request we finish by hand. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
}

beforeEach(() => mockAdd.mockReset());

describe("useSendComment", () => {
  it("sends a double tap once", async () => {
    const call = deferred<object>();
    mockAdd.mockReturnValue(call.promise);
    const { result } = await setup();
    await act(async () => {
      expect(result.current.send("Hello")).toBe(true);
      expect(result.current.send("Hello")).toBe(false);
    });
    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toMatchObject([{ content: "Hello", status: "sending" }]);
    await act(async () => call.resolve({ _id: "c1", postId: "p1", content: "Hello" }));
    expect(result.current.pending).toEqual([]);
  });

  it("ignores empty text", async () => {
    const { result } = await setup();
    await act(async () => expect(result.current.send("   ")).toBe(false));
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("keeps a failed comment, and retries it with the same clientId", async () => {
    mockAdd.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ _id: "c1", postId: "p1", content: "Hi", parentId: "root1" });
    const { result } = await setup();
    await act(async () => void result.current.send("Hi", { commentId: "root1", rootId: "root1", name: "Ada" }));
    expect(result.current.pending).toMatchObject([{ status: "failed", replyToName: "Ada" }]);
    const firstId = mockAdd.mock.calls[0][3].clientId;
    await act(async () => result.current.retry(result.current.pending[0]!.clientId));
    expect(mockAdd.mock.calls[1][3]).toEqual({ parentId: "root1", clientId: firstId });
    expect(result.current.pending).toEqual([]);
  });
});
