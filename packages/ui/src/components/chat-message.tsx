import { cx } from '../lib.js';

export interface ChatCitation {
  title: string;
  source?: string;
  excerpt: string;
}

interface ChatMessageBase {
  className?: string;
}

export type ChatMessageProps = ChatMessageBase &
  (
    | { role: 'user' | 'assistant'; content: string; citation?: never }
    | { role: 'citation'; citation: ChatCitation; content?: string }
  );

const roleLabel = {
  user: '你的消息',
  assistant: 'AI 回复',
  citation: '引用',
} as const;

export function ChatMessage(props: ChatMessageProps) {
  const { role, className } = props;
  const label =
    role === 'citation' ? `${roleLabel.citation} ${props.citation.title}` : roleLabel[role];

  return (
    <article className={cx('an-chat', `an-chat--${role}`, className)} aria-label={label}>
      <p className="an-chat__role">{roleLabel[role]}</p>
      {props.role === 'citation' ? (
        <div className="an-chat__citation">
          <p className="an-chat__title">{props.citation.title}</p>
          {props.citation.source ? (
            <p className="an-chat__source">{props.citation.source}</p>
          ) : null}
          <blockquote className="an-chat__excerpt">{props.citation.excerpt}</blockquote>
          {props.content ? <p className="an-chat__content">{props.content}</p> : null}
        </div>
      ) : (
        <p className="an-chat__content">{props.content}</p>
      )}
    </article>
  );
}
