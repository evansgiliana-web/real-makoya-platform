"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SearchBar from "./SearchBar";
import SignOutButton from "./SignOutButton";
import { useState } from "react";

type Props = { role: string; name: string; email: string };

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Agency Admin",
  FIELD_AGENT: "Field Agent",
  CLIENT: "FMCG Client",
};

export default function TopNav({ role, name, email }: Props) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const isAgency = role === "SUPER_ADMIN" || role === "ADMIN" || role === "FIELD_AGENT";
  const isManager = role === "SUPER_ADMIN" || role === "ADMIN";

  const links = [
    isAgency && { href: "/dashboard", label: "Dashboard" },
    isAgency && { href: "/dashboard/stores", label: "Stores" },
    { href: "/dashboard/reports", label: role === "CLIENT" ? "Reports" : "Client Reports" },
    isManager && { href: "/dashboard/users", label: "Users" },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <header className="no-print sticky top-0 z-10 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 md:px-8 h-16 flex items-center gap-6">
        <Link href="/dashboard" className="flex items-center gap-2 flex-shrink-0">
          <div className="h-8 w-8 rounded-lg bg-accent-500 flex items-center justify-center text-brand-900 font-bold text-sm">
            RM
          </div>
          <span className="font-semibold text-brand-900 hidden sm:inline">Real Makoya</span>
        </Link>

        <nav className="flex items-center gap-1 flex-1">
          {links.map((link) => {
            const active = link.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active ? "bg-brand-700 text-white" : "text-gray-600 hover:bg-brand-50 hover:text-brand-900"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {isAgency && (
          <div className="hidden md:block">
            <SearchBar />
          </div>
        )}

        <div className="relative flex-shrink-0">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="h-9 w-9 rounded-full bg-brand-700 text-white text-sm font-semibold flex items-center justify-center"
          >
            {name.charAt(0).toUpperCase() || "?"}
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-200 bg-white shadow-lg p-3 text-sm">
              <p className="font-medium text-brand-900 truncate">{name}</p>
              <p className="text-gray-500 text-xs truncate mb-1">{email}</p>
              <p className="text-xs text-accent-600 font-medium mb-3">{ROLE_LABELS[role]}</p>
              <SignOutButton />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
