import { nextTick } from "vue";
import { vi } from "vitest";

/** Let every promise the page queued resolve, then let Vue repaint. */
export const flush = async () => {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
    await nextTick();
  }
};

/**
 * Wait out the filter debounce, which `useResourcePage` holds for 250ms because asking the deployed
 * database for a page costs a round trip the operator pays for on every keystroke.
 *
 * Advancing that clock, rather than sleeping next to it, is what makes a filter assertion hold: a
 * fixed sleep only clears the window when the machine hands the timer back on time, and under a
 * loaded suite it does not -- the page then asks for its page after the test has already read the
 * call list. Needs `vi.useFakeTimers()` in the test's `beforeEach`.
 */
export const settle = async () => {
  await vi.advanceTimersByTimeAsync(260);
  await flush();
};
