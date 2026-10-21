import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acquirePrintSession,
  isPrintSessionBusy,
  mayPrintNextLabel,
} from "./print-session";
afterEach(() => vi.useRealTimers());
describe("global print reservation", () => {
  it("rejects a second print route while a job owns the printer and releases idempotently", () => {
    const release = acquirePrintSession();
    expect(release).not.toBeNull();
    expect(isPrintSessionBusy()).toBe(true);
    expect(acquirePrintSession()).toBeNull();
    release!();
    expect(isPrintSessionBusy()).toBe(false);
    const releaseNext = acquirePrintSession();
    release!();
    expect(isPrintSessionBusy()).toBe(true);
    releaseNext!();
  });
  it("keeps ownership throughout a pause and resumes only after the pause is cleared", async () => {
    vi.useFakeTimers();
    const release = acquirePrintSession()!;
    const control = { pause: true, cancel: false };
    let started = false;
    const pending = mayPrintNextLabel(control).then((result) => {
      started = result;
    });
    await vi.advanceTimersByTimeAsync(500);
    expect(started).toBe(false);
    expect(acquirePrintSession()).toBeNull();
    control.pause = false;
    await vi.advanceTimersByTimeAsync(100);
    await pending;
    expect(started).toBe(true);
    release();
  });
  it("cancels a paused job without starting another label", async () => {
    vi.useFakeTimers();
    const control = { pause: true, cancel: false };
    const pending = mayPrintNextLabel(control);
    control.cancel = true;
    await vi.advanceTimersByTimeAsync(100);
    expect(await pending).toBe(false);
    expect(await mayPrintNextLabel({ pause: false, cancel: true })).toBe(false);
  });
});
