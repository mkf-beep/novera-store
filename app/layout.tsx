import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NOVERA | Modern Football Culture",
  description:
    "NOVERA -- modern football culture, premium jerseys and streetwear.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}