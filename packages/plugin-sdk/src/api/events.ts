import type { Disposable } from '../disposable.js';

export interface NoteCreatedEvent {
  type: 'note:created';
  path: string;
}

export interface NoteModifiedEvent {
  type: 'note:modified';
  path: string;
}

export interface NoteOpenedEvent {
  type: 'note:opened';
  path: string;
}

export interface NoteRenamedEvent {
  type: 'note:renamed';
  from: string;
  to: string;
}

export interface NoteDeletedEvent {
  type: 'note:deleted';
  path: string;
}

export type NoteEvent =
  NoteCreatedEvent | NoteModifiedEvent | NoteOpenedEvent | NoteRenamedEvent | NoteDeletedEvent;

export type NoteEventType = NoteEvent['type'];

export const NOTE_EVENT_TYPES = [
  'note:created',
  'note:modified',
  'note:opened',
  'note:renamed',
  'note:deleted',
] as const satisfies readonly NoteEventType[];

/**
 * 笔记事件。subscribe 返回的 Disposable 会取消这一次订阅。
 * unsubscribe 按处理函数引用移除，只适用于同进程宿主；沙箱里请 dispose 订阅句柄。
 */
export interface EventsApi {
  subscribe<T extends NoteEventType>(
    type: T,
    handler: (event: Extract<NoteEvent, { type: T }>) => void,
  ): Disposable;

  unsubscribe<T extends NoteEventType>(
    type: T,
    handler: (event: Extract<NoteEvent, { type: T }>) => void,
  ): void;
}
