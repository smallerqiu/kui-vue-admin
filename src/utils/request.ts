import { message } from "kui-vue";
import { customAlphabet } from "nanoid";
import {
  clearAuthSession,
  getRefreshToken,
  getToken,
  updateAccessToken,
} from "./auth";
import { appConfig } from "@/config/app";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789";
const nanoid = customAlphabet(alphabet, 16);

export interface ApiResponse<T = any> {
  code: number;
  data: T;
  msg: string;
  [key: string]: any;
}

// 扩展 Fetch 配置
interface RequestOptions extends RequestInit {
  timeout?: number;
  _retry?: boolean;
}

export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

const request = {
  _maps: new Map<string, AbortController>(),

  destroy(): void {
    this._maps.forEach((controller) => controller.abort());
    this._maps.clear();
  },

  async _base<T = any>(
    method: string,
    url: string,
    data: any = {},
    customOptions: RequestOptions = {},
  ): Promise<T> {
    const {
      timeout = 30000,
      headers: customHeaders,
      _retry,
      ...requestOptions
    } = customOptions;
    const controller = new AbortController();
    const requestId = nanoid();
    this._maps.set(requestId, controller);

    let finalUrl = url;
    if (!url.startsWith("http")) {
      const path = url.startsWith("/") ? url : `/${url}`;
      finalUrl =
        appConfig.apiBaseUrl.startsWith("/") &&
        (path === appConfig.apiBaseUrl ||
          path.startsWith(`${appConfig.apiBaseUrl}/`))
          ? path
          : `${appConfig.apiBaseUrl}${path}`;
    }

    const token = getToken();
    const headers = new Headers(customHeaders);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const options: RequestOptions = {
      ...requestOptions,
      method: method.toUpperCase(),
      signal: controller.signal,
      headers,
    };

    if (["POST", "PUT", "PATCH"].includes(options.method!)) {
      if (data instanceof FormData) {
        options.body = data;
        // 注意：发送 FormData 时不要手动设置 Content-Type
      } else {
        const body = this.filterNull(data);
        headers.set("Content-Type", "application/json");
        options.body = JSON.stringify(body);
      }
    } else {
      const params = this.filterNull(data);
      const queryString = new URLSearchParams(params).toString();
      if (queryString) {
        finalUrl += (finalUrl.includes("?") ? "&" : "?") + queryString;
      }
    }

    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(finalUrl, options);
      if (response.status === 401 && !_retry && getRefreshToken()) {
        const refreshed = await this.refreshSession();
        if (refreshed)
          return this._base<T>(method, url, data, {
            ...customOptions,
            _retry: true,
          });
      }
      if (!response.ok) {
        return await this.handleHttpError(response);
      }

      return await this.handleResponse<T>(response);
    } catch (err: any) {
      if (this._401Lock) {
        // nothing...
      } else if (err.name === "AbortError") {
        message.error("Request timeout.");
      } else {
        message.error(err.message || "Network Error");
      }
      throw err;
    } finally {
      clearTimeout(timer);
      this._maps.delete(requestId);
    }
  },

  /**
   * 过滤空值
   */
  filterNull(obj: any): Record<string, string> {
    if (
      !(obj instanceof Object) ||
      obj instanceof FormData ||
      Array.isArray(obj)
    )
      return obj;
    const params: Record<string, any> = {};
    Object.keys(obj).forEach((key) => {
      if (obj[key] !== null && obj[key] !== undefined && obj[key] !== "") {
        params[key] = obj[key];
      }
    });
    // console.log("params", params);
    return params;
  },

  /**
   * 异常处理
   */
  _401Lock: false,
  _refreshPromise: null as Promise<boolean> | null,
  async refreshSession(): Promise<boolean> {
    if (this._refreshPromise) return this._refreshPromise;
    this._refreshPromise = (async () => {
      try {
        if (appConfig.useMock) {
          updateAccessToken(`demo-${Date.now()}`);
          return true;
        }
        const response = await fetch(`${appConfig.apiBaseUrl}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: getRefreshToken() }),
        });
        if (!response.ok) return false;
        const result = await response.json();
        updateAccessToken(result.data?.token || result.token);
        return true;
      } catch {
        return false;
      } finally {
        this._refreshPromise = null;
      }
    })();
    return this._refreshPromise;
  },

  async handleHttpError(response: Response): Promise<never> {
    const { status } = response;
    const whiteList = ["/account/login"];
    if (
      status === 401 &&
      !whiteList.includes(location.pathname) &&
      !this._401Lock
    ) {
      this._401Lock = true;
      clearAuthSession();
      message.show({
        content: "Login expired. Redirecting to the login page...",
        type: "error",
        grouping: "login",
      });
      setTimeout(() => {
        const redirect = encodeURIComponent(
          location.pathname + location.search,
        );
        window.location.href = `/account/login?redirect=${redirect}`;
      }, 1000);
    }

    const errorData = await response.json().catch(() => ({}));
    const messageText =
      errorData.message ||
      errorData.msg ||
      response.statusText ||
      "Request failed";
    throw new ApiError(messageText, status, errorData);
  },

  /**
   * 响应解析
   */
  async handleResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get("content-type") || "";
    const disposition = response.headers.get("content-disposition") || "";

    if (disposition.includes("attachment")) {
      const blob = await response.blob();
      const match = disposition.match(/filename="?([^"]+)"?/);
      const fileName = match ? decodeURIComponent(match[1]) : "download";

      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
      return undefined as any;
    }

    if (contentType.includes("application/json")) {
      return await response.json();
    }
    return (await response.text()) as any;
  },

  get<T = any>(url: string, data?: any, options?: RequestOptions) {
    return this._base<T>("get", url, data, options);
  },
  post<T = any>(url: string, data?: any, options?: RequestOptions) {
    return this._base<T>("post", url, data, options);
  },
  put<T = any>(url: string, data?: any, options?: RequestOptions) {
    return this._base<T>("put", url, data, options);
  },
  delete<T = any>(url: string, data?: any, options?: RequestOptions) {
    return this._base<T>("delete", url, data, options);
  },
};

export default request;
