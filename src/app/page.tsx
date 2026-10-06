import { redirect } from "next/navigation";


export default async function Home() {
  const session = await getServerSession(authOptions);
  redirect(session ? "/dashboard" : "/login");
}

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

