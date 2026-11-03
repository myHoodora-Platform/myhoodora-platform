import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { SeeMoreText } from "../see-more-text";

/** What onTextLayout reports for the hidden full-text copy. */
async function layOut(lines: string[]) {
  const measure = screen.getByTestId("see-more-measure", { includeHiddenElements: true });
  await act(async () => fireEvent(measure, "textLayout", { nativeEvent: { lines: lines.map((text) => ({ text })) } }));
}

describe("SeeMoreText", () => {
  it("shows no 'See more' when the text fits", async () => {
    await render(<SeeMoreText id="a" text="Short" lines={5} />);
    await layOut(["Short"]);
    expect(screen.queryByText("See more")).toBeNull();
  });

  it("clamps when the rendered lines overflow, then opens in place and stays open", async () => {
    const lines = ["1\n", "2\n", "3\n", "4\n", "5\n", "6"];
    const view = await render(<SeeMoreText id="b" text={lines.join("")} lines={5} />);
    await layOut(lines);
    await fireEvent.press(screen.getByText("See more"));
    expect(screen.queryByText("See more")).toBeNull();
    expect(screen.getByText(lines.join(""))).toBeTruthy();

    // Scrolled away and back (remounted): still open.
    await view.rerender(<SeeMoreText key="remounted" id="b" text={lines.join("")} lines={5} />);
    expect(screen.queryByText("See more")).toBeNull();
  });

  it("opens the post instead for very long text", async () => {
    const open = jest.fn();
    const long = "word ".repeat(500);
    await render(<SeeMoreText id="c" text={long} lines={5} onOpenPost={open} />);
    await layOut(Array.from({ length: 40 }, () => "word word word word "));
    await fireEvent.press(screen.getByText("See more"));
    expect(open).toHaveBeenCalledTimes(1);
    expect(screen.getByText("See more")).toBeTruthy();
  });
});
