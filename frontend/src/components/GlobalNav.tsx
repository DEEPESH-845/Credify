"use client";

import React, { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";
import { truncateAddress } from "@/lib/utils";
import { EXPECTED_CHAIN_ID } from "@/lib/constants";

const NAV_MENU_ID = "mobile-nav-menu";

export default function GlobalNav(): React.ReactElement | null {
  const { address, jwt, chainId, disconnectWallet } = useWallet();
  const pathname = usePathname();
  const router = useRouter();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const navLinks = useMemo(() => {
    return [
      { href: "/feed", label: "Feed" },
      { href: "/connections", label: "Connections" },
      { href: address ? `/profile/${address}` : "/profile", label: "Profile" },
      { href: "/issuer", label: "Issuer" },
    ];
  }, [address]);

  const activeHref = useMemo(() => {
    if (pathname.startsWith("/profile")) return "profile";
    if (pathname.startsWith("/feed")) return "feed";
    if (pathname.startsWith("/connections")) return "connections";
    if (pathname.startsWith("/issuer")) return "issuer";
    return "";
  }, [pathname]);

  const isActive = useCallback(
    (href: string) => {
      if (href.startsWith("/profile")) return activeHref === "profile";
      if (href === "/feed") return activeHref === "feed";
      if (href === "/connections") return activeHref === "connections";
      if (href === "/issuer") return activeHref === "issuer";
      return false;
    },
    [activeHref]
  );

  const handleCopyAddress = useCallback(async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [address]);

  const handleDisconnect = useCallback(() => {
    disconnectWallet();
    router.push("/login");
  }, [disconnectWallet, router]);

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);

  const showChainWarning = chainId !== null && chainId !== EXPECTED_CHAIN_ID;

  // Hide nav on login route — AFTER all hooks
  if (pathname === "/login") {
    return null;
  }

  return (
    <>
      <nav
        aria-label="Main navigation"
        className="fixed top-0 left-0 right-0 z-50 bg-neutral-900/80 backdrop-blur-xl border-b border-white/[0.06]"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between">
            {/* Brand */}
            <Link
              href="/feed"
              className="text-lg font-bold text-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 rounded"
            >
              Credify
            </Link>

            {/* Desktop nav links */}
            <ul className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 ${
                      isActive(link.href)
                        ? "text-primary-400 bg-primary-500/10"
                        : "text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.04]"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            {/* Right side: address + disconnect */}
            <div className="flex items-center gap-3">
              {address && (
                <div className="relative">
                  <button
                    onClick={handleCopyAddress}
                    className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-neutral-300 bg-neutral-800/80 border border-white/[0.06] rounded-lg hover:bg-neutral-700/80 hover:border-white/[0.1] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
                    title="Copy wallet address"
                  >
                    <svg
                      className="h-4 w-4 text-neutral-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    {truncateAddress(address)}
                  </button>
                  {copied && (
                    <span
                      role="status"
                      className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-neutral-800 border border-white/[0.06] px-2 py-1 text-xs text-neutral-200 shadow-lg"
                    >
                      Copied!
                    </span>
                  )}
                </div>
              )}

              {jwt && (
                <button
                  onClick={handleDisconnect}
                  className="hidden sm:inline-flex items-center px-3 py-1.5 text-sm font-medium text-error-400 hover:text-error-300 hover:bg-error-500/10 rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
                >
                  Disconnect
                </button>
              )}

              {/* Hamburger menu button for mobile */}
              <button
                className="md:hidden inline-flex items-center justify-center p-2 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.04] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
                onClick={toggleMobileMenu}
                aria-expanded={mobileMenuOpen}
                aria-controls={NAV_MENU_ID}
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              >
                {mobileMenuOpen ? (
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div id={NAV_MENU_ID} className="md:hidden border-t border-white/[0.06] bg-neutral-900/95 backdrop-blur-xl">
            <ul className="px-4 py-3 space-y-1">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 ${
                      isActive(link.href)
                        ? "text-primary-400 bg-primary-500/10"
                        : "text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.04]"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            {/* Mobile address + disconnect */}
            <div className="border-t border-white/[0.06] px-4 py-3 space-y-2">
              {address && (
                <div className="relative">
                  <button
                    onClick={handleCopyAddress}
                    className="flex items-center gap-1.5 w-full px-3 py-2 text-sm text-neutral-300 bg-neutral-800/80 border border-white/[0.06] rounded-lg hover:bg-neutral-700/80 hover:border-white/[0.1] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
                  >
                    <svg
                      className="h-4 w-4 text-neutral-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    {truncateAddress(address)}
                  </button>
                  {copied && (
                    <span
                      role="status"
                      className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-neutral-800 border border-white/[0.06] px-2 py-1 text-xs text-neutral-200 shadow-lg"
                    >
                      Copied!
                    </span>
                  )}
                </div>
              )}

              {jwt && (
                <button
                  onClick={() => {
                    handleDisconnect();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-sm font-medium text-error-400 hover:text-error-300 hover:bg-error-500/10 rounded-lg transition-all duration-200 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Chain warning banner */}
      {showChainWarning && (
        <div
          className="fixed top-14 left-0 right-0 z-40 bg-error-500/10 border-b border-error-500/20 px-4 py-2 text-center text-sm text-error-300"
          role="alert"
        >
          ⚠️ You are connected to the wrong network. Please switch to the
          expected network (Chain ID: {EXPECTED_CHAIN_ID}).
        </div>
      )}
    </>
  );
}
