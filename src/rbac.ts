import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Real Makoya Agency | Retail Intelligence Platform",
  description:
    "Field data capture and compliance reporting platform for FMCG retail intelligence.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
