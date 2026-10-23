export const blobs = new Map<string, Buffer>();
let counter = 0;
export async function put(pathname: string, body: unknown) {
  const bytes = Buffer.from(await new Response(body as BodyInit).arrayBuffer());
  const url = `https://store${++counter}.public.blob.vercel-storage.com/${pathname}-r${counter}`;
  blobs.set(url, bytes);
  return { url, pathname };
}
export async function del(urls: string | string[]) {
  for (const u of Array.isArray(urls) ? urls : [urls]) blobs.delete(u);
}
