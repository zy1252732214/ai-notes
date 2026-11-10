import { type ReactNode } from 'react';
import { UiIcon } from '../icons.js';
import { useDomId } from '../lib.js';
import { IconButton } from './icon-button.js';
import { Overlay } from './overlay.js';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  description?: string;
  footer?: ReactNode;
  closeLabel?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  description,
  footer,
  closeLabel = '关闭',
}: DialogProps) {
  const titleId = useDomId('dialog-title');
  const descriptionId = useDomId('dialog-description');

  return (
    <Overlay
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      describedBy={description ? descriptionId : undefined}
      className="an-dialog"
    >
      <header className="an-dialog__header">
        <h2 id={titleId} className="an-dialog__title">
          {title}
        </h2>
        <IconButton label={closeLabel} size="sm" onClick={onClose}>
          <UiIcon name="close" />
        </IconButton>
      </header>
      {description ? (
        <p id={descriptionId} className="an-dialog__description">
          {description}
        </p>
      ) : null}
      <div className="an-dialog__body">{children}</div>
      {footer ? <footer className="an-dialog__footer">{footer}</footer> : null}
    </Overlay>
  );
}
