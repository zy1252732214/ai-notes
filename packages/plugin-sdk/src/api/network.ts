export type NetworkMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface NetworkRequest {
  url: string;
  method?: NetworkMethod;
  headers?: Readonly<Record<string, string>>;
  /** 文本正文。二进制请求不在 preview v1 里。 */
  body?: string;
}

export interface NetworkResponse {
  status: number;
  headers: Readonly<Record<string, string>>;
  body: string;
}

/**
 * 需要 `network`。沙箱没有原始网络出口，请求由宿主代发，
 * 并且 URL 的主机名必须落在 manifest 声明的 domains 里。
 */
export interface NetworkApi {
  fetch(request: NetworkRequest): Promise<NetworkResponse>;
}
