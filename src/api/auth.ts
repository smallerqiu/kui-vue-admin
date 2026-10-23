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
