import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/lib/wallet";
import { NavBar } from "@/components/NavBar";

const geistSans = Geist({
  variable: "--font-body",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bounty Verdict — trustless bug bounty escrow",
  description:
    "Security reports are escrowed in GEN and settled by GenLayer consensus, not by the maintainer who has an incentive to reject them.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-text">
        <WalletProvider>
          <NavBar />
          <main className="flex-1">{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}
