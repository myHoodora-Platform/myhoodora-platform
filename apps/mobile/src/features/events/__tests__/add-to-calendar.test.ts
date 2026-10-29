import { eventCalendar, eventIcs, googleCalendarUrl, icsFileName } from "@myhoodora/api-contract/calendar";
import { Linking } from "react-native";
import { addToCalendar } from "../add-to-calendar";

const mockNative = jest.fn();
jest.mock("expo", () => ({ requireOptionalNativeModule: (name: string) => mockNative(name) }));
const mockCreate = jest.fn();
jest.mock("expo-calendar/legacy", () => ({ createEventInCalendarAsync: (...args: unknown[]) => mockCreate(...args) }));

const post = { id: "p1", title: "Street clean-up, Saturday.", rest: "Bring gloves; we have bags.", eventDate: "2026-10-31T09:00:00.000Z", eventLocation: "Allen Avenue, by the bank" };
const entry = eventCalendar(post, "https://www.myhoodora.com/")!;

describe("eventCalendar", () => {
  it("lasts 3 hours, links back to the post and keeps the place", () => {
    expect(entry.title).toBe("Street clean-up, Saturday");
    expect(entry.start.toISOString()).toBe("2026-10-31T09:00:00.000Z");
    expect(entry.end.toISOString()).toBe("2026-10-31T12:00:00.000Z");
    expect(entry.url).toBe("https://www.myhoodora.com/p/p1");
    expect(entry.location).toBe("Allen Avenue, by the bank");
  });

  it("is null without a usable date", () => {
    expect(eventCalendar({ ...post, eventDate: undefined }, "https://a.b")).toBeNull();
    expect(eventCalendar({ ...post, eventDate: "soon" }, "https://a.b")).toBeNull();
  });
});

describe("googleCalendarUrl", () => {
  it("fills in the title, UTC times, details with the link, and place", () => {
    const url = new URL(googleCalendarUrl(entry));
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("dates")).toBe("20261031T090000Z/20261031T120000Z");
    expect(url.searchParams.get("text")).toBe("Street clean-up, Saturday");
    expect(url.searchParams.get("details")).toContain("On myHoodora: https://www.myhoodora.com/p/p1");
    expect(url.searchParams.get("location")).toBe("Allen Avenue, by the bank");
  });
});

describe("eventIcs", () => {
  const ics = eventIcs({ ...entry, description: "Bring gloves; we have bags. ".repeat(10) }, new Date("2026-10-28T00:00:00Z"));
  it("is one escaped event with a reminder and CRLF line ends", () => {
    expect(ics).toContain("BEGIN:VEVENT\r\n");
    expect(ics).toContain("DTSTART:20261031T090000Z");
    expect(ics).toContain("SUMMARY:Street clean-up\\, Saturday");
    expect(ics).toContain("TRIGGER:-PT1H");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
  it("folds long lines at 75 bytes", () => {
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics).toContain("\r\n ");
  });
  it("names the file after the title", () => {
    expect(icsFileName("Street clean-up, Saturday!")).toBe("Street clean-up Saturday.ics");
    expect(icsFileName("🎉")).toBe("event.ics");
  });
});

describe("addToCalendar", () => {
  const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  beforeEach(() => {
    mockNative.mockReset();
    mockCreate.mockReset();
    openURL.mockClear();
  });

  it("opens the phone's calendar when the module is in the build", async () => {
    mockNative.mockReturnValue({});
    mockCreate.mockResolvedValue({ action: "done", id: null });
    await expect(addToCalendar(entry)).resolves.toBe("app");
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ title: entry.title, startDate: entry.start, endDate: entry.end, location: entry.location }));
    expect(openURL).not.toHaveBeenCalled();
  });

  it("uses Google Calendar's page in an older build, without touching the module", async () => {
    mockNative.mockReturnValue(null);
    await expect(addToCalendar(entry)).resolves.toBe("web");
    expect(mockCreate).not.toHaveBeenCalled();
    expect(openURL).toHaveBeenCalledWith(expect.stringContaining("calendar.google.com"));
  });

  it("falls back to the page when the phone has no calendar app", async () => {
    mockNative.mockReturnValue({});
    mockCreate.mockRejectedValue(new Error("No Activity found"));
    await expect(addToCalendar(entry)).resolves.toBe("web");
  });
});
