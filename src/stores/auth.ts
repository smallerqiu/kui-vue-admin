import {
  clearAuthSession,
  getAuthUser,
  getToken,
  setAuthSession,
  type AuthUser,
} from "@/utils/auth";
import { defineStore } from "pinia";

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
    logout() {
      clearAuthSession();
      this.token = "";
      this.user = {};
    },
    updateUser(user: AuthUser) {
      this.user = { ...this.user, ...user };
      setAuthSession(
        this.token,
        this.user,
        Boolean(localStorage.getItem("token")),
      );
    },
  },
});
