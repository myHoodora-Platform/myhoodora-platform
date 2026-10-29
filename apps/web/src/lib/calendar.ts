/**
 * "Add to calendar" without any service. The entry, the .ics file and the Google Calendar link are
 * shared with the app (@myhoodora/api-contract/calendar); downloading the file is the browser's part.
 */
import { eventIcs, icsFileName, type CalendarEvent } from "@myhoodora/api-contract/calendar";

export { eventIcs, googleCalendarUrl, type CalendarEvent } from "@myhoodora/api-contract/calendar";

/** Download the .ics; the phone or computer offers to add it to the calendar. */
export function downloadIcs(e: CalendarEvent): void {
  const url = URL.createObjectURL(new Blob([eventIcs(e)], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = icsFileName(e.title);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
