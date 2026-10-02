import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROLE_LABELS } from "@/lib/rbac";
import NavLink from "@/components/NavLink";
import SignOutButton from "@/components/SignOutButton";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = session.user.role;
  const isAgency = role === "SUPER_ADMIN" || role === "ADMIN" || role === "FIELD_AGENT";
  const isManager = role === "SUPER_ADMIN" || role === "ADMIN";

  return (
    <div className="min-h-screen flex">
      <nav className="w-64 bg-brand-900 text-white flex-shrink-0 flex flex-col no-print">
        <div className="p-5 border-b border-brand-800">
          <div className="h-10 w-10 rounded-lg bg-accent-500 flex items-center justify-center text-brand-900 font-bold mb-2">
            RM
          </div>
          <p className="font-semibold leading-tight">Real Makoya Agency</p>
          <p className="text-xs text-brand-100">{ROLE_LABELS[role]}</p>
        </div>

        <div className="flex-1 p-3 space-y-1">
          {isAgency && <NavLink href="/dashboard">Overview</NavLink>}
          {isAgency && <NavLink href="/dashboard/stores">Stores</NavLink>}
          <NavLink href="/dashboard/reports">
            {role === "CLIENT" ? "Reports" : "Client Reports"}
          </NavLink>
          {isManager && <NavLink href="/dashboard/users">Users & Access</NavLink>}
        </div>

        <div className="p-4 border-t border-brand-800 text-sm">
          <p className="truncate">{session.user.name}</p>
          <p className="text-xs text-brand-100 truncate mb-3">{session.user.email}</p>
          <SignOutButton />
        </div>
      </nav>

      <main className="flex-1 bg-brand-50 min-h-screen">
        <div className="max-w-6xl mx-auto p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
