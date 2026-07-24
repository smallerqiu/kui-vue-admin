import { message } from "kui-vue";
import { customAlphabet } from "nanoid";

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
  headers?: Record<string, string>;
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
    const timeout = data.timeout || customOptions.timeout || 30000;
    const controller = new AbortController();
    const requestId = nanoid();
    this._maps.set(requestId, controller);

    let finalUrl = url;
    if (!url.startsWith("http")) {
      // 在这里加自定义前缀
      // finalUrl = `/${url}`;
    }

    const token = localStorage.getItem("token");
    const options: RequestOptions = {
      method: method.toUpperCase(),
      signal: controller.signal,
      redirect: "manual",
      headers: {
        Authorization: `Bearer ${token}`,
        ...customOptions.headers,
      },
      ...customOptions,
    };

    if (["POST", "PUT", "PATCH"].includes(options.method!)) {
      if (data instanceof FormData) {
        options.body = data;
        // 注意：发送 FormData 时不要手动设置 Content-Type
      } else {
        const body = this.filterNull(data);
        options.headers!["Content-Type"] = "application/json";
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
      clearTimeout(timer);

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

  async handleHttpError(response: Response): Promise<never> {
    const { status, type } = response;
    const whiteList = ["/account/login"];
    if (status === 0 && type == "opaqueredirect" && !this._401Lock) {
      this._401Lock = true;
      message.show({
        content: "Login expired. Redirecting to the login page...",
        type: "error",
        grouping: "login",
      });
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
    if (
      status === 401 &&
      !whiteList.includes(location.pathname) &&
      !this._401Lock
    ) {
      this._401Lock = true;
      localStorage.removeItem("token");
      localStorage.removeItem("user_info");
      message.show({
        content: "Login expired. Redirecting to the login page...",
        type: "error",
        grouping: "login",
      });
      setTimeout(() => {
        window.location.href = "/account/login";
      }, 1000);
    } else if (status === 500) {
      //message.error("Internal Server Error (500)");
    }

    const errorData = await response.json().catch(() => ({}));
    throw { ...errorData, status };
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
