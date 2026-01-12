import React, { useEffect, useMemo, useState } from 'react';
import { Button, Space, Typography } from 'antd';

import { CodeBlock } from './CodeBlock.jsx';

const { Text } = Typography;

function parseMarkdownBlocks(input) {
  const text = String(input ?? '').replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const blocks = [];

  const isFence = (line) => line.trim().startsWith('```');
  const fenceLang = (line) => line.trim().slice(3).trim();
  const isHeading = (line) => /^#{1,6}\s+/.test(line.trim());
  const headingLevel = (line) => line.trim().match(/^#+/)[0].length;
  const headingText = (line) => line.trim().replace(/^#{1,6}\s+/, '');
  const isQuote = (line) => /^\s*>/.test(line);
  const stripQuote = (line) => line.replace(/^\s*>\s?/, '');
  const isUnordered = (line) => /^\s*[-*+]\s+/.test(line);
  const stripUnordered = (line) => line.replace(/^\s*[-*+]\s+/, '');
  const isOrdered = (line) => /^\s*\d+\.\s+/.test(line);
  const stripOrdered = (line) => line.replace(/^\s*\d+\.\s+/, '');

  const isSpecial = (line) =>
    isFence(line) || isHeading(line) || isQuote(line) || isUnordered(line) || isOrdered(line);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (isFence(line)) {
      const language = fenceLang(line);
      const codeLines = [];
      i += 1;
      while (i < lines.length && !isFence(lines[i])) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length && isFence(lines[i])) i += 1;
      blocks.push({ type: 'code', language, text: codeLines.join('\n') });
      continue;
    }

    if (isHeading(line)) {
      blocks.push({ type: 'heading', level: headingLevel(line), text: headingText(line) });
      i += 1;
      continue;
    }

    if (isQuote(line)) {
      const quoteLines = [];
      while (i < lines.length && isQuote(lines[i])) {
        quoteLines.push(stripQuote(lines[i]));
        i += 1;
      }
      blocks.push({ type: 'blockquote', text: quoteLines.join('\n') });
      continue;
    }

    if (isUnordered(line)) {
      const items = [];
      while (i < lines.length && isUnordered(lines[i])) {
        items.push(stripUnordered(lines[i]));
        i += 1;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    if (isOrdered(line)) {
      const items = [];
      while (i < lines.length && isOrdered(lines[i])) {
        items.push(stripOrdered(lines[i]));
        i += 1;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const paragraph = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !isSpecial(lines[i])) {
      paragraph.push(lines[i]);
      i += 1;
    }
    blocks.push({ type: 'p', text: paragraph.join('\n') });
  }

  return blocks;
}

function splitInlineByCode(text) {
  const raw = String(text ?? '');
  const out = [];
  const re = /`([^`]+)`/g;
  let last = 0;
  let match;
  while ((match = re.exec(raw))) {
    if (match.index > last) out.push({ type: 'text', value: raw.slice(last, match.index) });
    out.push({ type: 'code', value: match[1] });
    last = match.index + match[0].length;
  }
  if (last < raw.length) out.push({ type: 'text', value: raw.slice(last) });
  return out;
}

function splitInlineByLinks(text) {
  const raw = String(text ?? '');
  const out = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let match;
  while ((match = re.exec(raw))) {
    if (match.index > last) out.push({ type: 'text', value: raw.slice(last, match.index) });
    out.push({ type: 'link', label: match[1], href: match[2] });
    last = match.index + match[0].length;
  }
  if (last < raw.length) out.push({ type: 'text', value: raw.slice(last) });
  return out;
}

function splitInlineByStrong(text) {
  const raw = String(text ?? '');
  const out = [];
  const re = /\*\*([\s\S]+?)\*\*/g;
  let last = 0;
  let match;
  while ((match = re.exec(raw))) {
    if (match.index > last) out.push({ type: 'text', value: raw.slice(last, match.index) });
    out.push({ type: 'strong', value: match[1] });
    last = match.index + match[0].length;
  }
  if (last < raw.length) out.push({ type: 'text', value: raw.slice(last) });
  return out;
}

function splitInlineByEm(text) {
  const raw = String(text ?? '');
  const out = [];
  const re = /\*([^*]+?)\*/g;
  let last = 0;
  let match;
  while ((match = re.exec(raw))) {
    if (match.index > last) out.push({ type: 'text', value: raw.slice(last, match.index) });
    out.push({ type: 'em', value: match[1] });
    last = match.index + match[0].length;
  }
  if (last < raw.length) out.push({ type: 'text', value: raw.slice(last) });
  return out;
}

function renderInlineNodes(text) {
  const tokens = [];
  splitInlineByCode(text).forEach((segment) => {
    if (segment.type !== 'text') {
      tokens.push(segment);
      return;
    }
    splitInlineByLinks(segment.value).forEach((linkSeg) => {
      if (linkSeg.type !== 'text') {
        tokens.push(linkSeg);
        return;
      }
      splitInlineByStrong(linkSeg.value).forEach((strongSeg) => {
        if (strongSeg.type !== 'text') {
          tokens.push(strongSeg);
          return;
        }
        splitInlineByEm(strongSeg.value).forEach((emSeg) => tokens.push(emSeg));
      });
    });
  });

  return tokens.map((token, idx) => {
    if (token.type === 'code') {
      return (
        <code
          key={idx}
          style={{
            fontFamily: 'SFMono-Regular, Consolas, Menlo, monospace',
            fontSize: '0.95em',
            background: 'var(--ds-code-inline-bg)',
            border: '1px solid var(--ds-code-inline-border)',
            padding: '0 6px',
            borderRadius: 6,
          }}
        >
          {token.value}
        </code>
      );
    }
    if (token.type === 'strong') {
      return (
        <Text key={idx} strong>
          {token.value}
        </Text>
      );
    }
    if (token.type === 'em') {
      return (
        <Text key={idx} italic>
          {token.value}
        </Text>
      );
    }
    if (token.type === 'link') {
      const href = String(token.href || '').trim();
      const safe =
        href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:');
      if (!safe) return <Text key={idx}>{token.label}</Text>;
      return (
        <a key={idx} href={href} target="_blank" rel="noreferrer">
          {token.label}
        </a>
      );
    }
    return <React.Fragment key={idx}>{token.value}</React.Fragment>;
  });
}

function renderInlineWithBreaks(text) {
  const lines = String(text ?? '').split('\n');
  return lines.map((line, idx) => (
    <React.Fragment key={idx}>
      {renderInlineNodes(line)}
      {idx < lines.length - 1 ? <br /> : null}
    </React.Fragment>
  ));
}

function renderBlock(block, idx) {
  if (!block) return null;
  if (block.type === 'code') {
    const lang = block.language ? String(block.language).trim() : '';
    return (
      <CodeBlock
        key={idx}
        text={block.text}
        maxHeight={320}
        highlight
        language={lang || undefined}
        wrap={false}
        showLineNumbers
        disableScroll
      />
    );
  }
  if (block.type === 'heading') {
    const level = Math.min(Math.max(Number(block.level) || 1, 1), 6);
    const fontSize = level === 1 ? 16 : level === 2 ? 15 : level === 3 ? 14 : 13;
    return (
      <div key={idx} style={{ fontWeight: 600, fontSize, margin: '6px 0 2px' }}>
        {renderInlineNodes(block.text)}
      </div>
    );
  }
  if (block.type === 'blockquote') {
    return (
      <div
        key={idx}
        style={{
          borderLeft: '3px solid var(--ds-blockquote-border)',
          paddingLeft: 10,
          margin: '6px 0',
          color: 'var(--ds-blockquote-text)',
        }}
      >
        {renderInlineWithBreaks(block.text)}
      </div>
    );
  }
  if (block.type === 'ul' || block.type === 'ol') {
    const ListTag = block.type === 'ol' ? 'ol' : 'ul';
    return (
      <ListTag key={idx} style={{ paddingLeft: 20, margin: '6px 0' }}>
        {(Array.isArray(block.items) ? block.items : []).map((item, itemIdx) => (
          <li key={itemIdx} style={{ margin: '2px 0' }}>
            {renderInlineWithBreaks(item)}
          </li>
        ))}
      </ListTag>
    );
  }
  if (block.type === 'p') {
    return (
      <div key={idx} style={{ margin: '6px 0', lineHeight: '1.65' }}>
        {renderInlineWithBreaks(block.text)}
      </div>
    );
  }
  return null;
}

export function MarkdownBlock({ text, maxHeight = 260, alwaysExpanded = false }) {
  const [expanded, setExpanded] = useState(alwaysExpanded);
  useEffect(() => {
    setExpanded(alwaysExpanded);
  }, [alwaysExpanded]);

  if (text === null || text === undefined) return <Text type="secondary">无内容</Text>;
  const content = typeof text === 'string' ? text : String(text);
  const lineCount = content.split('\n').length;
  const tooLong = content.length > 1200 || lineCount > 26;
  const limited = !(alwaysExpanded || expanded);

  const blocks = useMemo(() => parseMarkdownBlocks(content), [content]);

  return (
    <Space direction="vertical" size={4} style={{ width: '100%' }}>
      <div
        style={{
          background: 'var(--ds-panel-bg)',
          border: '1px solid var(--ds-panel-border)',
          borderRadius: 10,
          padding: '10px 12px',
          maxHeight: limited ? maxHeight : undefined,
          overflow: limited ? 'auto' : 'visible',
        }}
      >
        {blocks.length === 0 ? <Text type="secondary">无内容</Text> : blocks.map(renderBlock)}
      </div>
      {tooLong && !alwaysExpanded ? (
        <Button type="link" size="small" onClick={() => setExpanded(!expanded)}>
          {expanded ? '收起' : '展开全部'}
        </Button>
      ) : null}
    </Space>
  );
}
