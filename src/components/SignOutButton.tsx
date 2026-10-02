"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-xs font-semibold text-accent-500 hover:text-accent-600"
    >
      Sign out
    </button>
  );
}
