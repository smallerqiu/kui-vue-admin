import request from "@/utils/request";
import type { AuthUser } from "@/utils/auth";

export interface LoginResult {
  token: string;
  refreshToken: string;
  user: AuthUser;
}
export const loginApi = async (account: string, password: string): Promise<LoginResult> =>
  request.post<LoginResult>("/auth/login", { account, password }, { skipRefresh: true });

export const meApi = () => request.get<AuthUser>("/auth/me");
export const logoutApi = () => request.post("/auth/logout", {}, { skipRefresh: true });
export const updateProfileApi = (data: {
  fullName: string;
  email: string;
  phone: string;
  bio: string;
}) => request.put<AuthUser>("/auth/me", data);

/**
 * Replaces the account's password. The server verifies the current one, stores the new hash and
 * revokes every session for this account, so the caller cannot stay signed in with the token it
 * already holds -- `loginRequired` is the server saying so.
 */
export const changePasswordApi = (oldPassword: string, password: string) =>
  request.post<{ ok: boolean; loginRequired: boolean }>("/auth/password", { oldPassword, password });
