export { default } from "next-auth/middleware";

export const config = {
  // Protect everything under /dashboard — NextAuth redirects unauthenticated
  // users to /login automatically.
  matcher: ["/dashboard/:path*"],
};
