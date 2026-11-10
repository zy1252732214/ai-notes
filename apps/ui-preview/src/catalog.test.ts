import { describe, expect, it } from 'vitest';
import { previewSections } from './catalog.js';

describe('ui preview', () => {
  it('shows every component from the library brief', () => {
    expect(previewSections.map((section) => section.id)).toEqual([
      'button',
      'icon-button',
      'input',
      'textarea',
      'select',
      'switch',
      'tabs',
      'tooltip',
      'dialog',
      'toast',
      'command-palette',
      'search-result',
      'panel',
      'chat-message',
      'settings-row',
    ]);
  });
});
