import QRCode from "qrcode";
import { env } from "../env";

export function eventJoinUrl(code: string) {
  return `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/e/${code}`;
}

/** Inline SVG QR code for the join link (rendered server-side; scales to any screen). */
export async function eventQrSvg(code: string) {
  return QRCode.toString(eventJoinUrl(code), { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#111116", light: "#ffffff" } });
}
