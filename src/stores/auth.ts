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
import { appConfig } from "@/config/app";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    token: getToken(),
    user: getAuthUser(),
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
    },
    async logout() {
      try {
        if (!appConfig.useMock && getToken()) await logoutApi();
      } finally {
        clearAuthSession();
        this.token = "";
        this.user = {};
      }
    },
    syncSession() {
      this.token = getToken();
      this.user = getAuthUser();
    },
    async loadUser() {
      if (!appConfig.useMock) this.updateUser(await meApi());
    },
    updateUser(user: AuthUser) {
      this.user = { ...this.user, ...user };
      this.token = getToken();
      setAuthSession(this.token, this.user, Boolean(localStorage.getItem("token")), getRefreshToken());
    },
  },
});
