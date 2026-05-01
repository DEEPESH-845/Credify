"use client";

import React from "react";

interface PageLayoutProps {
  children: React.ReactNode;
  maxWidth?: string;
  title?: string;
}

export default function PageLayout({
  children,
  maxWidth = "max-w-3xl",
  title,
}: PageLayoutProps): React.ReactElement {
  return (
    <main
      id="main-content"
      className="min-h-screen bg-neutral-950 bg-gradient-mesh pt-20 px-4 sm:px-6 pb-12"
    >
      <div className={`mx-auto ${maxWidth} animate-fade-in`}>
        {title && (
          <h1 className="text-2xl font-semibold text-neutral-50 mb-8 tracking-tight">{title}</h1>
        )}
        {children}
      </div>
    </main>
  );
}
