export interface AuthUser {
  id?: string | number;
  name?: string;
  fullName?: string;
  email?: string;
  avatar?: string;
  roles?: string[];
  [key: string]: unknown;
}

const TOKEN_KEY = "token";
const USER_KEY = "user_info";

export const getToken = () => localStorage.getItem(TOKEN_KEY) || "";

export const getAuthUser = (): AuthUser => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "{}");
  } catch {
    localStorage.removeItem(USER_KEY);
    return {};
  }
};

export const setAuthSession = (token: string, user: AuthUser) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAuthSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem("routes");
};
