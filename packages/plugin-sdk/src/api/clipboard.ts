/** 需要 `clipboard`。 */
export interface ClipboardApi {
  readText(): Promise<string>;
  writeText(text: string): Promise<void>;
}
