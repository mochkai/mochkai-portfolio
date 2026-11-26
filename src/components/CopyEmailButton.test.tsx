import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { COPY_STATUS_MS, CopyEmailButton, REANNOUNCE_GAP_MS } from "./CopyEmailButton";

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

  it("announces Copied again on a repeat click while the confirmation is still shown", async () => {
    vi.useFakeTimers();
    mockClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
    render(<CopyEmailButton email="ada@example.com" />);

    await clickCopy();
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
    act(() => vi.advanceTimersByTime(1000));

    // The second click empties the live region first, so re-adding the text is a real change.
    await clickCopy();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    act(() => vi.advanceTimersByTime(REANNOUNCE_GAP_MS));
    expect(screen.getByRole("status")).toHaveTextContent("Copied");

    // The first click's reset was cancelled: the text stays for a full period after the repeat.
    act(() => vi.advanceTimersByTime(COPY_STATUS_MS - 1));
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("announces both copies when a second click lands while the first write is pending", async () => {
    vi.useFakeTimers();
    const pending: Array<() => void> = [];
    const writeText = vi.fn(() => new Promise<void>((resolve) => pending.push(() => resolve())));
    mockClipboard({ writeText });
    render(<CopyEmailButton email="ada@example.com" />);
    const status = () => screen.getByRole("status");

    await clickCopy();
    await clickCopy();
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(status()).toBeEmptyDOMElement();

    // The first write finishes: "Copied" appears.
    await act(async () => pending.shift()?.());
    expect(status()).toHaveTextContent("Copied");

    // The second finishes: the region empties, then "Copied" is re-added as a fresh change.
    await act(async () => pending.shift()?.());
    expect(status()).toBeEmptyDOMElement();
    act(() => vi.advanceTimersByTime(REANNOUNCE_GAP_MS));
    expect(status()).toHaveTextContent("Copied");

    // Only the latest reset is pending: no earlier timer clears the text early.
    act(() => vi.advanceTimersByTime(COPY_STATUS_MS - 1));
    expect(status()).toHaveTextContent("Copied");
    act(() => vi.advanceTimersByTime(1));
    expect(status()).toBeEmptyDOMElement();
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
