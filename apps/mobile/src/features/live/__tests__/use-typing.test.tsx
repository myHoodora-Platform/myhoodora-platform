import { act, renderHook } from "@testing-library/react-native";
import { liveBus } from "../live-bus";
import { SHOW_FOR_MS, SIGNAL_EVERY_MS, useTypingIndicator, useTypingSignal } from "../use-typing";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("liveBus", () => {
  it("delivers events to listeners of that type until they unsubscribe", () => {
    const seen: string[] = [];
    const off = liveBus.on("chat.typing", (e) => seen.push(e.conversationId ?? ""));
    liveBus.emit({ type: "chat.typing", conversationId: "c1" });
    liveBus.emit({ type: "chat.message", conversationId: "c1" });
    off();
    liveBus.emit({ type: "chat.typing", conversationId: "c2" });
    expect(seen).toEqual(["c1"]);
  });
});

describe("useTypingIndicator", () => {
  const render = () => renderHook(() => useTypingIndicator("chat.typing", ["chat.message"], (e) => e.conversationId === "c1"));

  it("shows for this conversation only, and hides a few seconds after the last signal", async () => {
    const hook = await render();
    await act(async () => liveBus.emit({ type: "chat.typing", conversationId: "other" }));
    expect(hook.result.current).toBe(false);

    await act(async () => liveBus.emit({ type: "chat.typing", conversationId: "c1" }));
    expect(hook.result.current).toBe(true);
    await act(async () => jest.advanceTimersByTime(SHOW_FOR_MS - 1));
    expect(hook.result.current).toBe(true);
    await act(async () => jest.advanceTimersByTime(1));
    expect(hook.result.current).toBe(false);
  });

  it("hides at once when their message arrives", async () => {
    const hook = await render();
    await act(async () => liveBus.emit({ type: "chat.typing", conversationId: "c1" }));
    await act(async () => liveBus.emit({ type: "chat.message", conversationId: "c1" }));
    expect(hook.result.current).toBe(false);
  });
});

describe("useTypingSignal", () => {
  it("sends at most one signal per window, and none for an empty box", async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    jest.setSystemTime(10_000);
    const hook = await renderHook(({ draft }: { draft: string }) => useTypingSignal(draft, send), { initialProps: { draft: "  " } });
    expect(send).not.toHaveBeenCalled();

    await hook.rerender({ draft: "H" });
    await hook.rerender({ draft: "He" });
    expect(send).toHaveBeenCalledTimes(1);

    jest.setSystemTime(10_000 + SIGNAL_EVERY_MS);
    await hook.rerender({ draft: "Hel" });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("ignores a failed signal", async () => {
    const send = jest.fn().mockRejectedValue(new Error("offline"));
    await renderHook(() => useTypingSignal("Hi", send));
    await act(async () => undefined);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
