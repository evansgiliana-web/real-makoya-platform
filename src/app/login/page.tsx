"use client";

import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, FormEvent } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await signIn("credentials", {
      email: email.toLowerCase().trim(),
      password,
      redirect: false,
    });

    if (res?.error) {
      setLoading(false);
      setError("Invalid email or password.");
      return;
    }

    const session = await getSession();
    const role = (session?.user as { role?: string } | undefined)?.role;
    setLoading(false);

    // Clients land on reports; agency staff on ops dashboard
    if (role === "CLIENT") {
      router.replace("/dashboard/reports");
    } else {
      router.replace("/dashboard");
    }
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-brand-900 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto h-12 w-12 rounded-xl bg-accent-500 flex items-center justify-center text-brand-900 font-bold text-xl mb-3">
            RM
          </div>
          <h1 className="text-white text-xl font-semibold">Real Makoya Agency</h1>
          <p className="text-brand-100 text-sm mt-1">Retail Intelligence Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="text-center text-brand-100/70 text-xs mt-4">
          Accounts are created by your administrator.
        </p>
      </div>
    </main>
  );
}
