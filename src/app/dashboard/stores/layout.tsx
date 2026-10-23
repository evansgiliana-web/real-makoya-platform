import { requireAgency } from "@/lib/guards";

// Everything under /dashboard/stores holds owner personal information and is
// for agency staff only. Individual pages ALSO call requireAgency().
export default async function StoresLayout({ children }: { children: React.ReactNode }) {
  await requireAgency();
  return <>{children}</>;
}
