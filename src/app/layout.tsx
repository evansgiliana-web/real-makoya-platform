import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Real Makoya Agency | Retail Intelligence Platform",
  description:
    "Retail intelligence platform for structured field assessments, product insights, compliance observations and reviewed partner reporting.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
