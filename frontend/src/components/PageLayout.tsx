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
      className="min-h-screen bg-neutral-50 pt-20 px-4 sm:px-6"
    >
      <div className={`mx-auto ${maxWidth}`}>
        {title && (
          <h1 className="text-3xl font-bold text-neutral-900 mb-6">{title}</h1>
        )}
        {children}
      </div>
    </main>
  );
}
