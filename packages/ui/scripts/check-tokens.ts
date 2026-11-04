/**
 * 校验 tokens.css 与 tokens.ts 的变量名和数值一致，并覆盖主题辅助的基本行为。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  THEME_ATTRIBUTE,
  applyTheme,
  bindTheme,
  colors,
  cssVar,
  cssVarNames,
  fontFamily,
  getSystemTheme,
  layout,
  radius,
  readAppliedTheme,
  resolveTheme,
  space,
  typeScale,
} from "../src/index.ts";

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const cssPath = join(packageDir, "tokens.css");
const css = readFileSync(cssPath, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

let failures = 0;

function fail(message: string): void {
  failures += 1;
  console.error(message);
}

function parseRules(source: string): Map<string, Map<string, string>> {
  const rules = new Map<string, Map<string, string>>();
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  for (const match of source.matchAll(ruleRe)) {
    const selector = match[1]?.trim() ?? "";
    const body = match[2] ?? "";
    const decls = new Map<string, string>();
    const declRe = /(--an-[a-z0-9-]+)\s*:\s*([^;]+)\s*;/g;
    for (const decl of body.matchAll(declRe)) {
      const name = decl[1];
      const value = decl[2]?.trim();
      if (!name || value === undefined) continue;
      if (decls.has(name)) fail(`${selector} 中 ${name} 重复定义`);
      decls.set(name, value);
    }
    if (rules.has(selector)) fail(`选择器重复：${selector}`);
    rules.set(selector, decls);
  }
  return rules;
}

function expectValue(
  decls: Map<string, string> | undefined,
  name: string,
  expected: string,
  selector: string,
): void {
  const actual = decls?.get(name);
  if (actual !== expected) {
    fail(`${selector} 的 ${name} 应为 ${expected}，实际为 ${actual ?? "缺失"}`);
  }
}

const rules = parseRules(css);
const root = rules.get(":root");
const dark = rules.get('[data-theme="dark"]');

if (!root) fail("缺少 :root 令牌块");
if (!dark) fail('缺少 [data-theme="dark"] 令牌块');

const expectedNames = new Set<string>();

for (const token of Object.keys(colors.light) as (keyof typeof colors.light)[]) {
  const name = cssVarNames.color[token];
  expectedNames.add(name);
  expectValue(root, name, colors.light[token], ":root");
  expectValue(dark, name, colors.dark[token], '[data-theme="dark"]');
}

for (const token of Object.keys(fontFamily) as (keyof typeof fontFamily)[]) {
  const name = cssVarNames.fontFamily[token];
  expectedNames.add(name);
  expectValue(root, name, fontFamily[token], ":root");
}

for (const level of Object.keys(typeScale) as (keyof typeof typeScale)[]) {
  const style = typeScale[level];
  const sizeName = cssVarNames.fontSize[level];
  const lineName = cssVarNames.lineHeight[level];
  const weightName = cssVarNames.fontWeight[level];
  expectedNames.add(sizeName);
  expectedNames.add(lineName);
  expectedNames.add(weightName);
  expectValue(root, sizeName, style.fontSize, ":root");
  expectValue(root, lineName, style.lineHeight, ":root");
  expectValue(root, weightName, String(style.fontWeight), ":root");
}

for (const step of Object.keys(space) as unknown as (keyof typeof space)[]) {
  const name = cssVarNames.space[step];
  expectedNames.add(name);
  expectValue(root, name, space[step], ":root");
}

for (const token of Object.keys(radius) as (keyof typeof radius)[]) {
  const name = cssVarNames.radius[token];
  expectedNames.add(name);
  expectValue(root, name, radius[token], ":root");
}

for (const token of Object.keys(layout) as (keyof typeof layout)[]) {
  const name = cssVarNames.layout[token];
  expectedNames.add(name);
  expectValue(root, name, layout[token], ":root");
}

function assertKnown(selector: string, decls: Map<string, string> | undefined): void {
  if (!decls) return;
  for (const name of decls.keys()) {
    if (!expectedNames.has(name)) fail(`${selector} 含有未在 tokens.ts 声明的变量 ${name}`);
  }
}

assertKnown(":root", root);
assertKnown('[data-theme="dark"]', dark);

for (const selector of rules.keys()) {
  if (selector !== ":root" && selector !== '[data-theme="dark"]') {
    fail(`意外的令牌选择器：${selector}`);
  }
}

if (cssVar(cssVarNames.color.accent) !== "var(--an-accent)") {
  fail("cssVar() 没有拼出 var(--an-accent)");
}

if (resolveTheme("light") !== "light" || resolveTheme("dark") !== "dark") {
  fail("resolveTheme 没有原样返回手动主题");
}

if (getSystemTheme() !== "light") {
  fail("没有 matchMedia 时应回退到浅色");
}

const attrs = new Map<string, string>();
const fakeRoot = {
  setAttribute(name: string, value: string) {
    attrs.set(name, value);
  },
  getAttribute(name: string) {
    return attrs.get(name) ?? null;
  },
} as HTMLElement;

if (applyTheme("dark", fakeRoot) !== "dark" || fakeRoot.getAttribute(THEME_ATTRIBUTE) !== "dark") {
  fail("applyTheme('dark') 应写入 data-theme=dark");
}
if (readAppliedTheme(fakeRoot) !== "dark") fail("readAppliedTheme 应读回 dark");
if (applyTheme("light", fakeRoot) !== "light" || readAppliedTheme(fakeRoot) !== "light") {
  fail("applyTheme('light') 应写入 data-theme=light");
}

type MediaListener = (event: { matches: boolean }) => void;
const listeners = new Set<MediaListener>();
let matches = false;

Object.assign(globalThis, {
  window: {
    matchMedia(query: string) {
      return {
        get matches() {
          return matches;
        },
        media: query,
        addEventListener(type: string, listener: MediaListener) {
          if (type === "change") listeners.add(listener);
        },
        removeEventListener(type: string, listener: MediaListener) {
          if (type === "change") listeners.delete(listener);
        },
      };
    },
  },
});

if (resolveTheme("system") !== "light") fail("系统为浅色时 resolveTheme('system') 应为 light");
const stop = bindTheme("system", fakeRoot);
if (readAppliedTheme(fakeRoot) !== "light") fail("bindTheme('system') 应先写成当前系统主题");
matches = true;
for (const listener of listeners) listener({ matches: true });
if (readAppliedTheme(fakeRoot) !== "dark") fail("系统切到深色后 data-theme 应更新为 dark");
stop();
matches = false;
for (const listener of listeners) listener({ matches: false });
if (readAppliedTheme(fakeRoot) !== "dark") fail("取消订阅后不应再跟随系统");
if (listeners.size !== 0) fail("取消订阅后应移除系统主题监听");

if (failures > 0) {
  console.error(`令牌校验失败：${failures} 项`);
  process.exit(1);
}

console.log(`令牌校验通过：${expectedNames.size} 个 --an-* 变量与 tokens.ts 一致`);
