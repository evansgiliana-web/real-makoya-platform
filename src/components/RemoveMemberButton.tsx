"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RemoveMemberButton({
  organizationId,
  membershipId,
  name,
}: {
  organizationId: string;
  membershipId: string;
  name: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRemove() {
    if (!confirm(`Remove ${name} from this organization? Their login will be deactivated.`)) return;
    setLoading(true);
    const res = await fetch(`/api/organizations/${organizationId}/members/${membershipId}`, {
      method: "DELETE",
    });
    setLoading(false);
    if (res.ok) router.refresh();
    else alert("Could not remove this teammate.");
  }

  return (
    <button onClick={handleRemove} disabled={loading} className="text-xs font-semibold text-red-600 hover:text-red-700">
      Remove
    </button>
  );
}
