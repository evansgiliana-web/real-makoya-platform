import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });

        if (!user || !user.active) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

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
      // Re-check the account on every session read. Without this, a user who
      // has been deactivated or removed from an organization could keep using
      // their existing login (JWT sessions last ~30 days) until it expires.
      // Throwing here makes getServerSession() return null, so pages redirect
      // to /login and API routes answer 401. Role changes also apply instantly.
      const dbUser = await prisma.user.findUnique({
        where: { id: token.uid },
        select: { active: true, role: true },
      });
      if (!dbUser || !dbUser.active) {
        throw new Error("Account is deactivated or no longer exists.");
      }

      if (session.user) {
        (session.user as any).role = dbUser.role;
        (session.user as any).id = token.uid;
        (session.user as any).companyName = token.companyName;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
