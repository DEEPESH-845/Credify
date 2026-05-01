"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";

export default function Home() {
  const { jwt, isSessionLoading } = useWallet();
  const router = useRouter();

  useEffect(() => {
    if (isSessionLoading) return;

    if (jwt) {
      router.replace("/feed");
    } else {
      router.replace("/login");
    }
  }, [jwt, isSessionLoading, router]);

  if (isSessionLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </main>
    );
  }

  return null;
}
