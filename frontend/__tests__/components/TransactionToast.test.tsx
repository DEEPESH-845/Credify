/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import TransactionToast from "@/components/TransactionToast";

describe("TransactionToast", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders loading state with spinner", () => {
    render(
      <TransactionToast status="loading" message="Submitting transaction..." />
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Submitting transaction...")).toBeInTheDocument();
    expect(screen.getByLabelText("Transaction pending")).toBeInTheDocument();
  });

  it("renders success state with checkmark", () => {
    render(
      <TransactionToast status="success" message="Transaction confirmed!" />
    );

    expect(screen.getByText("Transaction confirmed!")).toBeInTheDocument();
  });

  it("renders error state with error icon and message", () => {
    render(
      <TransactionToast status="error" message="Transaction failed" />
    );

    expect(screen.getByText("Transaction failed")).toBeInTheDocument();
  });

  it("shows retry button in error state when onRetry is provided", () => {
    const onRetry = jest.fn();
    render(
      <TransactionToast
        status="error"
        message="Network error"
        onRetry={onRetry}
      />
    );

    const retryButton = screen.getByText("Retry");
    expect(retryButton).toBeInTheDocument();
  });

  it("calls onRetry when retry button is clicked", async () => {
    jest.useRealTimers();
    const onRetry = jest.fn();
    const user = userEvent.setup();

    render(
      <TransactionToast
        status="error"
        message="Network error"
        onRetry={onRetry}
      />
    );

    await user.click(screen.getByText("Retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not show retry button when onRetry is not provided", () => {
    render(
      <TransactionToast status="error" message="Transaction failed" />
    );

    expect(screen.queryByText("Retry")).not.toBeInTheDocument();
  });

  it("does not show dismiss button in loading state", () => {
    render(
      <TransactionToast status="loading" message="Loading..." />
    );

    expect(
      screen.queryByLabelText("Dismiss notification")
    ).not.toBeInTheDocument();
  });

  it("shows dismiss button in success and error states", () => {
    const { rerender } = render(
      <TransactionToast status="success" message="Done!" />
    );

    expect(screen.getByLabelText("Dismiss notification")).toBeInTheDocument();

    rerender(
      <TransactionToast status="error" message="Failed" />
    );

    expect(screen.getByLabelText("Dismiss notification")).toBeInTheDocument();
  });

  it("auto-dismisses success toast after autoDismissMs", () => {
    const onDismiss = jest.fn();
    render(
      <TransactionToast
        status="success"
        message="Done!"
        onDismiss={onDismiss}
        autoDismissMs={3000}
      />
    );

    expect(screen.getByText("Done!")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does not auto-dismiss when autoDismissMs is 0", () => {
    const onDismiss = jest.fn();
    render(
      <TransactionToast
        status="success"
        message="Done!"
        onDismiss={onDismiss}
        autoDismissMs={0}
      />
    );

    act(() => {
      jest.advanceTimersByTime(10000);
    });

    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByText("Done!")).toBeInTheDocument();
  });
});
