import {
  clearAuthSession,
  getAuthUser,
  getToken,
  getRefreshToken,
  setAuthSession,
  type AuthUser,
} from "@/utils/auth";
import { defineStore } from "pinia";
import { logoutApi, meApi } from "@/api/auth";

/**
 * How long a permission snapshot is good enough to gate a navigation, and how long to wait
 * before trying the server again after a failed attempt.
 */
const USER_SNAPSHOT_WINDOW = 60_000;

/**
 * The drawn session as one comparable value: who is logged in and what they may do.
 *
 * Watchers need it as a string. A getter that returns `[id, permissions.join(",")]` builds a new
 * array on every run, and Vue compares a getter's result by identity, so replacing the snapshot
 * with identical content still counts as a change -- which made every background `/auth/me`
 * refresh (once a minute) pull the notification list and the system settings over again, two more
 * round trips each against a database that is not on this host.
 */
export const sessionSignature = (
  id: AuthUser["id"],
  permissions: string[],
): string => `${id}|${permissions.join(",")}`;

export const useAuthStore = defineStore("auth", {
  state: () => ({
    token: getToken(),
    user: getAuthUser(),
    /** When the last authoritative user snapshot arrived, 0 when there never was one. */
    userLoadedAt: 0,
    /** When a fetch was last attempted, so a slow server is hit once per window, not per click. */
    userAttemptedAt: 0,
  }),
  getters: {
    roles: (state) => state.user.roles || [],
    permissions: (state) => state.user.permissions || [],
    dataScope: (state) => state.user.dataScope || "self",
  },
  actions: {
    login(token: string, user: AuthUser, persistent = true, refreshToken = "") {
      setAuthSession(token, user, persistent, refreshToken);
      this.token = token;
      this.user = user;
      this.userLoadedAt = this.userAttemptedAt = Date.now();
    },
    /** Drops the local pair and the snapshot without asking the server anything. */
    endSession() {
      clearAuthSession();
      this.token = "";
      this.user = {};
      this.userLoadedAt = this.userAttemptedAt = 0;
    },
    async logout() {
      try {
        // The server revokes the pair; without a token there is no session to revoke.
        if (getToken()) await logoutApi();
      } finally {
        this.endSession();
      }
    },
    syncSession() {
      this.token = getToken();
      this.user = getAuthUser();
    },
    async loadUser() {
      this.updateUser(await meApi());
    },
    /**
     * The navigation guard used to `await loadUser()` on every transition, which put a remote
     * round trip (p50 767 ms against the deployed database) in front of each page for a
     * snapshot that only changes when somebody edits a role or a profile. The server checks
     * permissions on every request, so this client copy only decides which menus and buttons
     * to draw: a stale one costs a click on a link that then 403s, a missing one costs a blank
     * page. Load it on the first navigation after boot -- with no snapshot there is nothing to
     * gate on -- then keep it warm in the background and never make a page wait for it again.
     */
    async refreshUser(window = USER_SNAPSHOT_WINDOW) {
      const now = Date.now();
      if (!this.userLoadedAt) {
        try {
          await this.loadUser();
        } catch (error) {
          this.invalidateUserSnapshot();
          throw error;
        }
        return;
      }
      if (now - this.userAttemptedAt >= window) {
        this.userAttemptedAt = now;
        void this.loadUser().catch(() => {
          this.userAttemptedAt = 0;
        });
      }
    },
    /** Drop the timestamps so the next navigation fetches for real. */
    invalidateUserSnapshot() {
      this.userLoadedAt = this.userAttemptedAt = 0;
    },
    updateUser(user: AuthUser) {
      this.user = { ...this.user, ...user };
      this.userLoadedAt = this.userAttemptedAt = Date.now();
      this.token = getToken();
      setAuthSession(this.token, this.user, Boolean(localStorage.getItem("token")), getRefreshToken());
    },
  },
});
