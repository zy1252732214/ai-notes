/**
 * 插件向 AI 注册工具时携带的参数模式。
 * 只覆盖对象、标量和数组，够描述一次工具调用，不是完整的 JSON Schema。
 */
export type JsonSchema = JsonSchemaObject | JsonSchemaScalar | JsonSchemaArray;

export interface JsonSchemaObject {
  type: 'object';
  properties?: Readonly<Record<string, JsonSchema>>;
  required?: readonly string[];
  additionalProperties?: boolean;
  description?: string;
}

export interface JsonSchemaScalar {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'null';
  description?: string;
  enum?: readonly (string | number | boolean | null)[];
}

export interface JsonSchemaArray {
  type: 'array';
  items?: JsonSchema;
  description?: string;
}
