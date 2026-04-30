/**
 * @jest-environment jsdom
 */
import React from "react";
import { renderHook, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock TransactionContext
const mockShowLoading = jest.fn().mockReturnValue("toast-1");
const mockShowSuccess = jest.fn().mockReturnValue("toast-2");
const mockShowError = jest.fn().mockReturnValue("toast-3");
const mockUpdateToast = jest.fn();
const mockDismissToast = jest.fn();
const mockDismissAll = jest.fn();

jest.mock("@/contexts/TransactionContext", () => ({
  useTransactionToast: () => ({
    showLoading: mockShowLoading,
    showSuccess: mockShowSuccess,
    showError: mockShowError,
    updateToast: mockUpdateToast,
    dismissToast: mockDismissToast,
    dismissAll: mockDismissAll,
  }),
}));

import { useTransaction } from "@/hooks/useTransaction";

describe("useTransaction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("starts in idle state", () => {
    const { result } = renderHook(() => useTransaction());

    expect(result.current.step).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.result).toBeNull();
  });

  it("transitions to pending then success on successful execution", async () => {
    const { result } = renderHook(() => useTransaction());

    await act(async () => {
      const res = await result.current.execute(async () => "done");
      expect(res).toBe("done");
    });

    expect(result.current.step).toBe("success");
    expect(result.current.result).toBe("done");
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("transitions to error on failed execution", async () => {
    const { result } = renderHook(() => useTransaction());

    await act(async () => {
      const res = await result.current.execute(async () => {
        throw new Error("Something went wrong");
      });
      expect(res).toBeNull();
    });

    expect(result.current.step).toBe("error");
    expect(result.current.error).toBe("Something went wrong");
    expect(result.current.isLoading).toBe(false);
  });

  it("shows loading toast during execution", async () => {
    const { result } = renderHook(() =>
      useTransaction({ pendingMessage: "Working..." })
    );

    await act(async () => {
      await result.current.execute(async () => "ok");
    });

    expect(mockShowLoading).toHaveBeenCalledWith("Working...");
  });

  it("updates toast to success on completion", async () => {
    const { result } = renderHook(() =>
      useTransaction({ successMessage: "All done!" })
    );

    await act(async () => {
      await result.current.execute(async () => "ok");
    });

    expect(mockUpdateToast).toHaveBeenCalledWith(
      "toast-1",
      "success",
      "All done!"
    );
  });

  it("updates toast to error on failure", async () => {
    const { result } = renderHook(() => useTransaction());

    await act(async () => {
      await result.current.execute(async () => {
        throw new Error("Oops");
      });
    });

    expect(mockUpdateToast).toHaveBeenCalledWith(
      "toast-1",
      "error",
      "Oops",
      undefined
    );
  });

  it("provides retry callback for network errors", async () => {
    const { result } = renderHook(() => useTransaction());

    const networkError = new Error("network error");
    (networkError as unknown as { code: string }).code = "NETWORK_ERROR";

    await act(async () => {
      await result.current.execute(async () => {
        throw networkError;
      });
    });

    // The updateToast should have been called with a retry function
    expect(mockUpdateToast).toHaveBeenCalledWith(
      "toast-1",
      "error",
      expect.any(String),
      expect.any(Function)
    );
  });

  it("parses revert reasons from ethers.js errors", async () => {
    const { result } = renderHook(() => useTransaction());

    await act(async () => {
      await result.current.execute(async () => {
        throw new Error('execution reverted: reason="Insufficient balance"');
      });
    });

    expect(result.current.error).toBe("Insufficient balance");
  });

  it("parses wallet rejection errors", async () => {
    const { result } = renderHook(() => useTransaction());

    const rejectionError = new Error("User rejected");
    (rejectionError as unknown as { code: string }).code = "ACTION_REJECTED";

    await act(async () => {
      await result.current.execute(async () => {
        throw rejectionError;
      });
    });

    expect(result.current.error).toBe(
      "Transaction was rejected in your wallet."
    );
  });

  it("resets state back to idle", async () => {
    const { result } = renderHook(() => useTransaction());

    await act(async () => {
      await result.current.execute(async () => "done");
    });

    expect(result.current.step).toBe("success");

    act(() => {
      result.current.reset();
    });

    expect(result.current.step).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(result.current.result).toBeNull();
  });

  it("does not show toast when showToast is false", async () => {
    const { result } = renderHook(() =>
      useTransaction({ showToast: false })
    );

    await act(async () => {
      await result.current.execute(async () => "ok");
    });

    expect(mockShowLoading).not.toHaveBeenCalled();
    expect(mockUpdateToast).not.toHaveBeenCalled();
  });
});
