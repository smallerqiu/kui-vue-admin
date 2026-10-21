import { appConfig } from "@/config/app";
import request from "@/utils/request";
import type { AuthUser } from "@/utils/auth";

export interface LoginResult {
  token: string;
  refreshToken: string;
  user: AuthUser;
}
export const loginApi = async (account: string, password: string): Promise<LoginResult> => {
  if (appConfig.useMock) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    if (
      !(
        (account === "admin@k-ui.cn" && password === "123456") ||
        (account === "13888888888" && password === "123456")
      )
    )
      throw new Error("账号或密码错误");
    return {
      token: `demo-${Date.now()}`,
      refreshToken: `refresh-${Date.now()}`,
      user: {
        name: "admin",
        fullName: "Administrator",
        email: "admin@k-ui.cn",
        roles: ["admin"],
        permissions: ["*"],
        dataScope: "all",
      },
    };
  }
  return request.post<LoginResult>("/auth/login", { account, password }, { skipRefresh: true });
};

export const meApi = () => request.get<AuthUser>("/auth/me");
export const logoutApi = () => request.post("/auth/logout", {}, { skipRefresh: true });
export const updateProfileApi = (data: {
  fullName: string;
  email: string;
  phone: string;
  bio: string;
}) => request.put<AuthUser>("/auth/me", data);
