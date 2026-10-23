// Minimal stand-ins for next/server so the real route handlers can run under plain Node.
export class NextRequest extends Request {}
export class NextResponse extends Response {
  static json(body: unknown, init?: ResponseInit) {
    const headers = new Headers(init?.headers);
    headers.set("content-type", "application/json");
    return new NextResponse(JSON.stringify(body), { ...init, headers });
  }
}
