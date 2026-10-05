"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Result = { id: string; name: string; town: string; province: string; ownerName: string };

export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        setResults(await res.json());
        setOpen(true);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  function goTo(id: string) {
    setOpen(false);
    setQuery("");
    router.push(`/dashboard/stores/${id}`);
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-xs">
      <input
        type="search"
        placeholder="Search stores, towns, owners…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
      />
      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => goTo(r.id)}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-brand-50 border-b border-gray-50 last:border-0"
            >
              <span className="font-medium text-brand-900">{r.name}</span>
              <span className="text-gray-500"> — {r.town}, {r.province}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
