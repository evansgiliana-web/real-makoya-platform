"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
        active ? "bg-brand-700 text-white" : "text-brand-100 hover:bg-brand-800 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
