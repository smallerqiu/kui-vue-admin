export interface AuthUser {
  id?: string | number;
  name?: string;
  fullName?: string;
  email?: string;
  avatar?: string;
  roles?: string[];
  permissions?: string[];
  dataScope?: "all" | "department" | "self";
  /** The biography the account owner types on the profile page; `null` when none was ever written. */
  bio?: string | null;
  /** The name of the department behind `departmentId`, or `null` for an account that has none. */
  departmentName?: string | null;
  /**
   * Where the sign-in before the current session came from, as the address the server saw. `null`
   * means this is the account's first recorded sign-in; the key is absent when the source never
   * answered. There is no place name behind it -- the application observes connections, not cities.
   */
  lastLoginIp?: string | null;
  /**
   * The sign-in before the current session, as the server's naive UTC stamp. `null` means this is
   * the account's first recorded sign-in; the key is absent when the source never answered.
   */
  lastLoginAt?: string | null;
  [key: string]: unknown;
}

const TOKEN_KEY = "token";
const USER_KEY = "user_info";
const REFRESH_TOKEN_KEY = "refresh_token";

const getSessionStorage = () => (localStorage.getItem(TOKEN_KEY) ? localStorage : sessionStorage);

export const getToken = () =>
  localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || "";

export const getAuthUser = (): AuthUser => {
  try {
    return JSON.parse(getSessionStorage().getItem(USER_KEY) || "{}");
  } catch {
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(USER_KEY);
    return {};
  }
};

export const getRefreshToken = () =>
  localStorage.getItem(REFRESH_TOKEN_KEY) || sessionStorage.getItem(REFRESH_TOKEN_KEY) || "";

/**
 * Whether a signed access token is already past the second the server will stop accepting it.
 *
 * The API signs every access token with an `exp` claim and refuses it after that, so the client can
 * read the same expiry instead of learning it from a rejected request. A cold boot whose token had
 * aged out used to put one 401 in front of every first request of the session.
 *
 * Returns false for anything that is not a readable JWT: an expiry the client cannot see is the
 * server's to enforce, and the 401 path still refreshes.
 */
export const isTokenExpired = (token: string, now = Date.now()): boolean => {
  const payload = token.split(".")[1];
  if (!payload) return false;
  try {
    const encoded = payload.replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(encoded + "=".repeat((4 - (encoded.length % 4)) % 4)));
    return typeof claims?.exp === "number" && claims.exp * 1000 <= now;
  } catch {
    return false;
  }
};

export const updateAccessToken = (token: string) => getSessionStorage().setItem(TOKEN_KEY, token);
export const setAuthSession = (
  token: string,
  user: AuthUser,
  persistent = true,
  refreshToken = "",
) => {
  const storage = persistent ? localStorage : sessionStorage;
  const staleStorage = persistent ? sessionStorage : localStorage;
  staleStorage.removeItem(TOKEN_KEY);
  staleStorage.removeItem(USER_KEY);
  staleStorage.removeItem(REFRESH_TOKEN_KEY);
  storage.setItem(TOKEN_KEY, token);
  storage.setItem(USER_KEY, JSON.stringify(user));
  if (refreshToken) storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  else storage.removeItem(REFRESH_TOKEN_KEY);
};

export const clearAuthSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
};
