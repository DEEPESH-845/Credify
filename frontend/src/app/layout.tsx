import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/contexts/WalletContext";
import { TransactionProvider } from "@/contexts/TransactionContext";
import GlobalNav from "@/components/GlobalNav";

export const metadata: Metadata = {
  title: "Blockchain Social Network",
  description:
    "A blockchain-based professional social network with verifiable credentials",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded focus:text-sm focus:font-medium focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2"
        >
          Skip to content
        </a>
        <WalletProvider>
          <TransactionProvider>
            <GlobalNav />
            {children}
          </TransactionProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
