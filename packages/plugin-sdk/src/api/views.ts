import type { Disposable } from '../disposable.js';

export type SettingsField =
  | {
      type: 'string';
      key: string;
      label: string;
      description?: string;
      default?: string;
    }
  | {
      type: 'boolean';
      key: string;
      label: string;
      description?: string;
      default?: boolean;
    }
  | {
      type: 'number';
      key: string;
      label: string;
      description?: string;
      default?: number;
    }
  | {
      type: 'select';
      key: string;
      label: string;
      description?: string;
      options: readonly { value: string; label: string }[];
      default?: string;
    };

interface ViewBase {
  id: string;
  title: string;
  icon?: string;
  /**
   * 沙箱 iframe 要加载的相对 HTML。省略时宿主把插件 UI 根挂到这个槽位。
   * 插件拿不到宿主页面的 DOM。
   */
  entry?: string;
}

export type SidebarPanel = ViewBase;

export type TabView = ViewBase;

export interface StatusBarItem {
  id: string;
  text: string;
  tooltip?: string;
  onClick?: () => void;
}

export interface SettingsTab {
  id: string;
  title: string;
  entry?: string;
  /** 没有自定义 entry 时，宿主按这些字段渲染设置页。 */
  fields?: readonly SettingsField[];
}

/** 注册界面都需要 `ui:panel`。插件拿不到宿主页面的 DOM。 */
export interface ViewsApi {
  registerSidebarPanel(panel: SidebarPanel): Disposable;
  registerTabView(view: TabView): Disposable;
  registerStatusBarItem(item: StatusBarItem): Disposable;
  registerSettingsTab(tab: SettingsTab): Disposable;
  /** 更新已注册状态栏条目的文本。 */
  setStatusBarText(id: string, text: string): void;
}
