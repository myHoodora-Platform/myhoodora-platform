/**
 * Provider-neutral media rules shared by content modules. Uploaded videos
 * are always delivered with a video file extension (the storage adapters
 * guarantee it), so the kind is readable from the URL alone.
 */
export function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm|m4v)(?:[?#]|$)/i.test(url) || /\/video\/upload\//.test(url);
}

/** Posts take photos (up to 10) or one short video, like Nextdoor. Returns an error message, or null when fine. */
export function mediaMixProblem(urls: string[]): string | null {
  const videos = urls.filter(isVideoUrl).length;
  if (videos > 1) return "A post can have one video.";
  if (videos === 1 && urls.length > 1) return "Add photos or a video, not both.";
  return null;
}

/**
 * The real type from a file's first bytes (its "magic number"), so a renamed
 * or mislabelled file can't pass as a photo or video. null = not one we take.
 */
export function sniffMediaType(head: Buffer): string | null {
  const ascii = (from: number, to: number) => head.subarray(from, to).toString("latin1");
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  if (ascii(0, 8) === "\x89PNG\r\n\x1a\n") return "image/png";
  if (ascii(0, 4) === "GIF8") return "image/gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (head.length >= 4 && head.readUInt32BE(0) === 0x1a45dfa3) return "video/webm";
  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12).toLowerCase();
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1", "heim", "heis"].includes(brand)) return "image/heic";
    if (brand === "qt  ") return "video/quicktime";
    return "video/mp4"; // isom, mp41, mp42, avc1, M4V, 3gp4…
  }
  return null;
}
