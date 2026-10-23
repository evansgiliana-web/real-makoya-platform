import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { LOGIN_MAX_FAILURES, LOGIN_WINDOW_MINUTES, isLoginLocked } from "@/lib/policies";

// A real login lasts one working day, not the 30-day NextAuth default.
const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

// Compared against when an email doesn't exist, so a wrong email and a wrong
// password take the same time and an attacker can't tell which emails are real.
let dummyHash: Promise<string> | null = null;
function getDummyHash() {
  if (!dummyHash) dummyHash = bcrypt.hash("not-a-real-password-just-for-timing", 12);
  return dummyHash;
}

function clientIp(headers: Record<string, unknown> | undefined): string | undefined {
  const forwarded = headers?.["x-forwarded-for"];
  return typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : undefined;
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  jwt: { maxAge: SESSION_MAX_AGE_SECONDS },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const email = credentials?.email?.toLowerCase().trim().slice(0, 254);
        const password = credentials?.password;
        if (!email || !password) return null;

        const ip = clientIp(req?.headers as Record<string, unknown> | undefined);

        // Throttle: after too many recent failures for this email, refuse to
        // even check the password until the window passes. Failures are kept in
        // the audit log, so this needs no extra database table.
        const since = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60 * 1000);
        const recentFailures = await prisma.auditLog.count({
          where: { action: "auth.login_failed", actorEmail: email, createdAt: { gte: since } },
        });
        if (isLoginLocked(recentFailures)) {
          await bcrypt.compare(password, await getDummyHash());
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        const valid = await bcrypt.compare(password, user?.passwordHash ?? (await getDummyHash()));

        if (!user || !user.active || !valid) {
          await writeAuditLog({
            actorId: null,
            actorEmail: email,
            actorRole: user?.role ?? null,
            action: "auth.login_failed",
            entityType: "User",
            entityId: user?.id ?? "unknown",
            meta: {
              reason: !user ? "unknown_email" : !user.active ? "inactive_account" : "bad_password",
              ip,
              failuresThisWindow: recentFailures + 1,
              lockoutAfter: LOGIN_MAX_FAILURES,
            },
          });
          return null;
        }

        await writeAuditLog({
          actorId: user.id,
          actorEmail: user.email,
          actorRole: user.role,
          action: "auth.login",
          entityType: "User",
          entityId: user.id,
          meta: { ip },
        });

        let organizationName: string | undefined;
        if (user.role === "CLIENT") {
          const membership = await prisma.orgMembership.findFirst({
            where: { userId: user.id },
            include: { organization: { select: { name: true } } },
          });
          organizationName = membership?.organization.name;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          companyName: organizationName,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.uid = (user as any).id;
        token.companyName = (user as any).companyName;
      }
      return token;
    },
    async session({ session, token }) {
      // Re-check the account on EVERY session read. A JWT can't be recalled, so
      // without this a deactivated or removed user (for example a teammate an
      // organization Owner just removed) would keep working until it expires.
      // Throwing makes getServerSession() return null: pages redirect to /login
      // and API routes answer 401. Role changes also take effect immediately.
      const uid = token.uid as string | undefined;
      const dbUser = uid
        ? await prisma.user.findUnique({ where: { id: uid }, select: { active: true, role: true } })
        : null;
      if (!dbUser || !dbUser.active) {
        throw new Error("Account is deactivated or no longer exists.");
      }

      if (session.user) {
        (session.user as any).role = dbUser.role;
        (session.user as any).id = uid;
        (session.user as any).companyName = token.companyName;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
