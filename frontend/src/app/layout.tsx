import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/contexts/WalletContext";
import { TransactionProvider } from "@/contexts/TransactionContext";

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
        <WalletProvider>
          <TransactionProvider>{children}</TransactionProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
