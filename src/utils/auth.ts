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

const getSessionStorage = () => (localStorage.getItem(TOKEN_KEY) ? localStorage : sessionStorage);

export const getToken = () => localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || "";

export const getAuthUser = (): AuthUser => {
  try {
    return JSON.parse(getSessionStorage().getItem(USER_KEY) || "{}");
  } catch {
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(USER_KEY);
    return {};
  }
};

export const setAuthSession = (token: string, user: AuthUser, persistent = true) => {
  const storage = persistent ? localStorage : sessionStorage;
  const staleStorage = persistent ? sessionStorage : localStorage;
  staleStorage.removeItem(TOKEN_KEY);
  staleStorage.removeItem(USER_KEY);
  storage.setItem(TOKEN_KEY, token);
  storage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAuthSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem("routes");
};
