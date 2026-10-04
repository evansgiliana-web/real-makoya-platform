import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

// In Next.js App Router, API routes are defined as handlers

const handler = NextAuth(authOptions)


export { handler as GET, handler as POST }
