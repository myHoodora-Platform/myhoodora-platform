import { permanentRedirect } from "next/navigation";

/** Old route: /admin/users(?uid=) → /admin/neighbours(/uid). */
export default async function Page({ searchParams }: { searchParams: Promise<{ uid?: string }> }) {
  const { uid } = await searchParams;
  permanentRedirect(uid ? `/admin/neighbours/${encodeURIComponent(uid)}` : "/admin/neighbours");
}
