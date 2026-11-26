import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { COPY_STATUS_MS, CopyEmailButton } from "./CopyEmailButton";

/** Replaces `navigator.clipboard` for one test (jsdom has none by default). */
function mockClipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", { value, configurable: true });
}

/** Clicks the button and lets the clipboard promise settle. */
async function clickCopy() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Copy email" }));
  });
}

afterEach(() => {
  vi.useRealTimers();
  mockClipboard(undefined);
});

describe("CopyEmailButton", () => {
  it("has an always-present, initially empty polite live region", () => {
    render(<CopyEmailButton email="ada@example.com" />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toBeEmptyDOMElement();
    expect(screen.getByRole("button", { name: "Copy email" })).toHaveAttribute("type", "button");
  });

  it("copies the address and announces Copied, then clears it", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard({ writeText });
    render(<CopyEmailButton email="ada@example.com" />);

    await clickCopy();
    expect(writeText).toHaveBeenCalledWith("ada@example.com");
    expect(screen.getByRole("status")).toHaveTextContent("Copied");

    act(() => vi.advanceTimersByTime(COPY_STATUS_MS));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("explains the fallback when the Clipboard API is unavailable", async () => {
    mockClipboard(undefined);
    render(<CopyEmailButton email="ada@example.com" />);
    await clickCopy();
    expect(screen.getByRole("status")).toHaveTextContent(/Select the address to copy it/);
  });

  it("explains the fallback when the clipboard write is refused", async () => {
    mockClipboard({ writeText: vi.fn().mockRejectedValue(new Error("denied")) });
    render(<CopyEmailButton email="ada@example.com" />);
    await clickCopy();
    expect(screen.getByRole("status")).toHaveTextContent(/Select the address to copy it/);
  });
});
