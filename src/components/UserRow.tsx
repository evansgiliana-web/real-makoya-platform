"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    active: boolean;
    companyName?: string | null;
    isSelf: boolean;
  };
  roleLabel: string;
};

export default function UserRow({ user, roleLabel }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggleActive() {
    setLoading(true);
    await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !user.active }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="py-3 px-2 flex items-center justify-between text-sm">
      <div>
        <p className="font-medium text-brand-900">
          {user.name} {user.isSelf && <span className="text-xs text-gray-400">(you)</span>}
        </p>
        <p className="text-gray-500">
          {user.email} · {roleLabel}
          {user.companyName ? ` · ${user.companyName}` : ""}
        </p>
      </div>
      {!user.isSelf && (
        <button
          onClick={toggleActive}
          disabled={loading}
          className={`text-xs font-semibold ${
            user.active ? "text-red-600 hover:text-red-700" : "text-green-600 hover:text-green-700"
          }`}
        >
          {user.active ? "Deactivate" : "Reactivate"}
        </button>
      )}
    </div>
  );
}
