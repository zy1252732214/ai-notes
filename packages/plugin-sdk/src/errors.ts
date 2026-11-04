/** 宿主拒绝或无法完成一次插件调用时抛出的错误。code 与 RPC 错误码一致。 */
export type PluginErrorCode =
  | 'permission_denied'
  | 'not_found'
  | 'already_exists'
  | 'invalid_request'
  | 'invalid_params'
  | 'internal'
  | 'cancelled'
  | 'not_supported';

export class PluginApiError extends Error {
  readonly code: PluginErrorCode;
  readonly details: unknown;

  constructor(code: PluginErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'PluginApiError';
    this.code = code;
    this.details = details;
  }
}
