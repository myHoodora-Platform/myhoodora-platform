import { ApiError } from "@myhoodora/api-contract/errors";
import type { Prompt } from "@myhoodora/api-contract/prompts";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { PromptBody } from "../prompt-body";

const mockAnswer = jest.fn();
jest.mock("@/core/auth/auth-provider", () => ({ useSignedInUser: () => ({ uid: "u1" }) }));
// Only what PromptBody uses: plain views and chainable entering animations.
jest.mock("react-native-reanimated", () => {
  const { View } = jest.requireActual("react-native");
  const anim: Record<string, unknown> = {};
  for (const k of ["duration", "springify", "damping"]) anim[k] = () => anim;
  return { __esModule: true, default: { View }, FadeIn: anim, ZoomIn: anim };
});
jest.mock("../feedback-api", () => ({ answerPrompt: (...a: unknown[]) => mockAnswer(...a) }));

const base: Prompt = { _id: "p1", kind: "stars", question: "How was selling?", options: [], commentMode: "optional", thanksMessage: "Thanks!", layout: "sheet", accent: "green", delaySeconds: 0, contextKey: "listing_sold" };

beforeEach(() => mockAnswer.mockReset());

describe("PromptBody", () => {
  it("stars: send waits for a choice, then sends it with the context and says thanks", async () => {
    mockAnswer.mockResolvedValue({ thanks: "Thanks for selling!" });
    await render(<PromptBody prompt={base} onDone={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Send" }).props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByLabelText("4 stars: Good"));
    expect(screen.getByText("Good")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Your comment"), " Quick ");
    await fireEvent.press(screen.getByRole("button", { name: "Send" }));
    expect(mockAnswer).toHaveBeenCalledWith({ uid: "u1" }, "p1", expect.objectContaining({ value: 4, comment: "Quick", contextKey: "listing_sold" }));
    expect(await screen.findByText("Thanks for selling!")).toBeTruthy();
  });

  it("a required comment must be written first", async () => {
    await render(<PromptBody prompt={{ ...base, kind: "thumbs", commentMode: "required", commentLabel: "What went wrong?" }} onDone={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText("Not really"));
    expect(screen.getByRole("button", { name: "Send" }).props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByLabelText("What went wrong?"), "Too slow");
    expect(screen.getByRole("button", { name: "Send" }).props.accessibilityState.disabled).toBe(false);
  });

  it("poll and 0–10 send the choice; already answered counts as done", async () => {
    mockAnswer.mockRejectedValue(new ApiError("You've already answered this.", 409, "client"));
    await render(<PromptBody prompt={{ ...base, kind: "poll", commentMode: "off", options: [{ id: "a", label: "Events" }, { id: "b", label: "Groups" }] }} onDone={jest.fn()} />);
    await fireEvent.press(screen.getByText("Groups"));
    await fireEvent.press(screen.getByRole("button", { name: "Send" }));
    expect(mockAnswer.mock.calls[0][2]).toMatchObject({ optionId: "b" });
    expect(await screen.findByText(/already have your answer/)).toBeTruthy();
  });
});
