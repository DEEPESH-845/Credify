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
      <div className="flex min-h-screen items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  // Session loaded but no JWT — redirect is triggered by the useEffect above
  if (jwt === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  // Session loaded and JWT exists — render children
  return <>{children}</>;
}
