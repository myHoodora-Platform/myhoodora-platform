import { permanentRedirect } from "next/navigation";

/** Old route kept so bookmarks work. */
export default function Page() {
  permanentRedirect("/admin/broadcasts");
}
