import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { ogFonts } from "@/lib/og/fonts";
import { badgeLabel, TIER_RING } from "@myhoodora/api-contract/engagement";
import { getPublicInvite } from "@/lib/api/invites";

/**
 * The "Share my badge" card (plan WP-C): the mascot ringed in the badge's colour, the badge, the Hood and
 * the invite code. It's the link preview on WhatsApp (flat colour and text, well under its ~300 KB
 * limit) and the image people save for their Status from the Invite page.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A myHoodora neighbourhood badge";

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const res = await getPublicInvite(code);
  const invite = res.status === "ok" ? res.invite : null;
  const label = badgeLabel(invite?.badge) ?? "myHoodora neighbour";
  // "Hood Builder · 4-day streak": the title alone on the big line and the streak under it, so the
  // renderer never breaks "4-day" across lines.
  const [headline, ...more] = label.split(" · ");
  const streakOnly = Boolean(invite?.badge) && !invite?.badge?.builder;
  const intro = invite ? `${invite.inviter.firstName} ${streakOnly ? "is on a" : "is a"}` : streakOnly ? "On a" : "Proud to be a";
  const ring = TIER_RING[invite?.badge?.tier ?? "builder"];
  const hood = invite?.hood ? `${invite.hood.name}${invite.hood.city ? `, ${invite.hood.city}` : ""}` : "My neighbourhood";
  // Read from disk: the image renderer won't fetch from our own (or any private) address.
  const mascot = `data:image/png;base64,${(await readFile(join(process.cwd(), "public/logo/app-icon.png"))).toString("base64")}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 64, background: "#f3f8f7", padding: 72, fontFamily: "Outfit" }}>
        <div style={{ display: "flex", width: 380, height: 380, borderRadius: 190, background: "white", border: `18px solid ${ring}`, alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
          <img src={mascot} width={344} height={344} alt="" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, flex: 1 }}>
          <span style={{ fontSize: 30, color: "#147c73", fontWeight: 700 }}>{intro}</span>
          <span style={{ fontSize: 66, color: "#0f2b29", fontWeight: 800, lineHeight: 1.1 }}>{headline}</span>
          {more.length ? <span style={{ fontSize: 40, color: "#147c73", fontWeight: 700 }}>{more.join(" · ")}</span> : null}
          <span style={{ fontSize: 34, color: "#4b5f5d" }}>{hood}</span>
          <div style={{ display: "flex", marginTop: 26 }}>
            <span style={{ fontSize: 30, color: "white", background: "#147c73", padding: "16px 32px", borderRadius: 999, fontWeight: 700 }}>
              {invite ? `Join with code ${invite.code}` : "Join your neighbours"}
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
