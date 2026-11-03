import { type CalendarEvent, googleCalendarUrl } from "@myhoodora/api-contract/calendar";
import { requireOptionalNativeModule } from "expo";
import { Linking } from "react-native";

type CalendarModule = typeof import("expo-calendar/legacy");

/**
 * Opens the phone's own "new event" screen, filled in, for the person to save: no calendar permission
 * on Android, nor on iOS 17 and later. Builds made before the calendar module was added, iPhones on
 * iOS 16 and phones with no calendar app get Google Calendar's page in the browser instead.
 * Resolves to how it was opened, or null when neither worked.
 */
export async function addToCalendar(entry: CalendarEvent): Promise<"app" | "web" | null> {
  // Checked first, and only then loaded: loading the module in a build without it throws.
  if (requireOptionalNativeModule("ExpoCalendar")) {
    try {
      // A static import would load it in every build; a dynamic import() isn't supported by Jest here.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Calendar = require("expo-calendar/legacy") as CalendarModule;
      await Calendar.createEventInCalendarAsync({
        title: entry.title,
        startDate: entry.start,
        endDate: entry.end,
        location: entry.location,
        notes: [entry.description, entry.url].filter(Boolean).join("\n\n"),
        url: entry.url,
      });
      return "app";
    } catch {
      // No calendar app, or iOS before 17 without calendar access: the browser.
    }
  }
  try {
    await Linking.openURL(googleCalendarUrl(entry));
    return "web";
  } catch {
    return null;
  }
}
