/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import TransactionStatus from "@/components/TransactionStatus";

describe("TransactionStatus", () => {
  it("renders a spinner with the given message", () => {
    render(<TransactionStatus message="Submitting transaction..." />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Submitting transaction...")).toBeInTheDocument();
    expect(screen.getByLabelText("Transaction pending")).toBeInTheDocument();
  });

  it("applies additional className when provided", () => {
    render(
      <TransactionStatus message="Loading..." className="mt-4 p-2" />
    );

    const container = screen.getByRole("status");
    expect(container.className).toContain("mt-4");
    expect(container.className).toContain("p-2");
  });

  it("uses aria-live polite for accessibility", () => {
    render(<TransactionStatus message="Waiting..." />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
  });
});
