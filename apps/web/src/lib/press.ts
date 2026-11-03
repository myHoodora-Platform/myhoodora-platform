/**
 * Announcements on /press. Keep these factual: each one points at a page on
 * the site that backs it up. Add a `date` (ISO) once a release goes out.
 */
export interface Announcement {
  id: string;
  tag: "Company" | "Product" | "Business" | "myHoodora AI";
  title: string;
  summary: string;
  href: string;
  date?: string;
}

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "launch",
    tag: "Company",
    title: "myHoodora opens in Lagos and Ibadan",
    summary:
      "The neighbourhood network for Nigeria is live, connecting verified neighbours for alerts, recommendations, events and a local marketplace.",
    href: "/about",
  },
  {
    id: "business",
    tag: "Business",
    title: "Free Business Pages for local businesses and estates",
    summary: "Artisans, shops and estate managers can now reach verified residents nearby with a free Business Page and posts.",
    href: "/business",
  },
  {
    id: "ai",
    tag: "myHoodora AI",
    title: "myHoodora AI opens its pilot for schools and lecturers",
    summary: "A new product that turns course material into a song, a learning game and a short explainer video.",
    href: "/ai",
  },
];
