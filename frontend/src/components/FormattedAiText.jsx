import React from 'react';

/**
 * Lightweight, safe formatted text renderer for GioAI responses.
 * Converts markdown bold (**text**), italics (*text*), code (`code`),
 * bullets (•, -), and numbered lists into clean, readable HTML elements.
 */
export default function FormattedAiText({ text }) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let currentList = null;
  let listType = null; // 'ul' or 'ol'

  const flushList = () => {
    if (currentList) {
      if (listType === 'ol') {
        elements.push(<ol key={`ol-${elements.length}`} className="ai-formatted-ol">{currentList}</ol>);
      } else {
        elements.push(<ul key={`ul-${elements.length}`} className="ai-formatted-ul">{currentList}</ul>);
      }
      currentList = null;
      listType = null;
    }
  };

  const renderInlineFormatted = (str) => {
    // Split by markdown bold (**text**), code (`code`), italic (*text*)
    const parts = [];
    const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push(str.substring(lastIndex, match.index));
      }
      const token = match[0];
      if (token.startsWith('**') && token.endsWith('**')) {
        parts.push(
          <strong key={`b-${lastIndex}`} className="ai-strong">
            {token.slice(2, -2)}
          </strong>
        );
      } else if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(
          <code key={`c-${lastIndex}`} className="ai-inline-code">
            {token.slice(1, -1)}
          </code>
        );
      } else if (token.startsWith('*') && token.endsWith('*')) {
        parts.push(
          <em key={`i-${lastIndex}`} className="ai-em">
            {token.slice(1, -1)}
          </em>
        );
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < str.length) {
      parts.push(str.substring(lastIndex));
    }

    return parts.length > 0 ? parts : str;
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Empty line
    if (!trimmed) {
      flushList();
      elements.push(<div key={`empty-${idx}`} className="ai-paragraph-break" />);
      return;
    }

    // Numbered list item (e.g. "1. " or "1) ")
    const numMatch = trimmed.match(/^(\d+)[\.\)]\s+(.*)$/);
    if (numMatch) {
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
        currentList = [];
      }
      currentList.push(
        <li key={`li-${idx}`} className="ai-list-item-numbered">
          <span className="ai-list-num">{numMatch[1]}.</span>
          <span className="ai-list-content">{renderInlineFormatted(numMatch[2])}</span>
        </li>
      );
      return;
    }

    // Bullet list item (e.g. "• ", "- ", "* ")
    const bulletMatch = trimmed.match(/^([•\-\*])\s+(.*)$/);
    if (bulletMatch) {
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
        currentList = [];
      }
      currentList.push(
        <li key={`li-${idx}`} className="ai-list-item-bullet">
          <span className="ai-bullet-dot">•</span>
          <span className="ai-list-content">{renderInlineFormatted(bulletMatch[2])}</span>
        </li>
      );
      return;
    }

    // Normal paragraph line
    flushList();
    elements.push(
      <p key={`p-${idx}`} className="ai-formatted-paragraph">
        {renderInlineFormatted(trimmed)}
      </p>
    );
  });

  flushList();

  return <div className="ai-formatted-content">{elements}</div>;
}
