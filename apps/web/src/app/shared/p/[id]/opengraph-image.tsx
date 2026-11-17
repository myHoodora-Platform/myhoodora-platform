import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getSharedPost, postKindWords, previewLine } from "@/lib/api/public-posts";

/**
 * The link preview WhatsApp, Facebook and X show for a shared post: the Hood, and the post's words
 * (Anyone posts) or what kind of post it is (everything else). Text and flat colour only, so it stays
 * well under WhatsApp's ~300 KB limit; no photos, which may show people's homes.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A post shared from a neighbourhood on myHoodora";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await getSharedPost(id);
  const post = res.status === "ok" ? res.post : null;
  const hood = post ? `${post.hood.name}${post.hood.city ? `, ${post.hood.city}` : ""}` : "Your neighbourhood";
  const line = post ? (post.mode === "full" ? previewLine(post, 180) : `A neighbour shared ${postKindWords(post.category)}.`) : "A neighbour shared this on myHoodora.";
  const official = post?.author.kind === "team";
  // Read from disk: the image renderer won't fetch from our own (or any private) address.
  const avatar = `data:image/png;base64,${(await readFile(join(process.cwd(), "public/logo/app-icon.png"))).toString("base64")}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f3f8f7", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <img src={avatar} width={88} height={88} style={{ borderRadius: 44 }} alt="" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 30, color: "#147c73", fontWeight: 700 }}>myHoodora</span>
            <span style={{ fontSize: 34, color: "#0f2b29", fontWeight: 700 }}>{hood}</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {official && <span style={{ fontSize: 26, color: "#147c73", fontWeight: 700 }}>Official · Hood Team</span>}
          <span style={{ fontSize: post?.mode === "full" ? 46 : 52, color: "#0f2b29", lineHeight: 1.25, fontWeight: 600 }}>{line}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 28, color: "#4b5f5d" }}>
            {post ? `${post.reactionTotal} reactions · ${post.commentCount} replies` : "Neighbours, together"}
          </span>
          <span style={{ fontSize: 28, color: "white", background: "#147c73", padding: "14px 28px", borderRadius: 999, fontWeight: 700 }}>Join your neighbours</span>
        </div>
      </div>
    ),
    size,
  );
}
