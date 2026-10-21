import { onActivated } from "vue";

/**
 * Run `callback` when a cached page comes back on screen.
 *
 * A page gets this for free from `useRemoteData` / `useResourcePage` only if it asks: those composables
 * load on mount and then leave the tab alone, because a round trip to the deployed database costs
 * more than the numbers it brings back. A page that genuinely wants the server's newest rows on
 * return -- a list another tab can write to, say -- registers them here.
 *
 * Vue fires `activated` for the mount that first filled the page too, and that one is already covered
 * by the load on mount, so it is skipped. Same contract as the react pages' `usePaneActivate`.
 */
export function usePaneActivate(callback: () => void) {
  let mounted = false;
  onActivated(() => {
    if (!mounted) {
      mounted = true;
      return;
    }
    callback();
  });
}
