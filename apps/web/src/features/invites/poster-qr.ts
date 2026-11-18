import QRCode from "qrcode";

/** The poster's QR code as SVG markup, for `link?src=qr` (error correction Q survives a smudge or a bit of tape). Server or browser. */
export function posterQr(link: string): Promise<string> {
  return QRCode.toString(`${link}?src=qr`, { type: "svg", errorCorrectionLevel: "Q", margin: 0, color: { dark: "#0b3d2e", light: "#ffffff" } });
}
