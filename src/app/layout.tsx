import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claude Hardware",
  description: "Describe anything — get a print-ready file for your printer.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
