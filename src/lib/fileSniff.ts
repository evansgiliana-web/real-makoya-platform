/**
 * Identify a file by its CONTENT, not by the type the browser claims.
 * A "PDF" that is really HTML or a script is rejected before it is stored.
 */
export type SniffedType = "application/pdf" | "image/jpeg" | "image/png" | "image/webp" | "image/heic";

const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);

function ascii(buf: Uint8Array, start: number, end: number): string {
  let s = "";
  for (let i = start; i < end && i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return s;
}

export function sniffContentType(buf: Uint8Array): SniffedType | null {
  if (buf.length < 12) return null;
  if (ascii(buf, 0, 5) === "%PDF-") return "application/pdf";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return "image/png";
  }
  if (ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 12) === "WEBP") return "image/webp";
  if (ascii(buf, 4, 8) === "ftyp" && HEIC_BRANDS.has(ascii(buf, 8, 12))) return "image/heic";
  return null;
}
