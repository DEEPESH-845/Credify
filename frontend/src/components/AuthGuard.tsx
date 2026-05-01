"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { jwt, isSessionLoading } = useWallet();
  const router = useRouter();

  useEffect(() => {
    if (!isSessionLoading && jwt === null) {
      router.replace("/login");
    }
  }, [jwt, isSessionLoading, router]);

  // While session is loading, show spinner and do NOT redirect
  if (isSessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950">
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-700 border-t-primary-500"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  // Session loaded but no JWT — redirect is triggered by the useEffect above
  if (jwt === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950">
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-700 border-t-primary-500"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  // Session loaded and JWT exists — render children
  return <>{children}</>;
}
