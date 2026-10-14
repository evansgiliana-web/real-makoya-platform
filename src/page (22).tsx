import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import TopNav from "@/components/TopNav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-brand-50">
      <TopNav
        role={session.user.role}
        name={session.user.name || ""}
        email={session.user.email || ""}
      />
      <main className="max-w-7xl mx-auto p-6 md:p-8">{children}</main>
    </div>
  );
}
