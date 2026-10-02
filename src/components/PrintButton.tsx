"use client";

export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-secondary">
      Print / Save as PDF
    </button>
  );
}
