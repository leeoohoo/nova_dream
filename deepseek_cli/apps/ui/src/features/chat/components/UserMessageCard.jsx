import React, { useMemo } from 'react';
import { Card, Space, Tag, Typography } from 'antd';

import { MarkdownBlock } from '../../../components/MarkdownBlock.jsx';

const { Text } = Typography;

function normalizeId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function formatTime(ts) {
  const ms = Date.parse(ts);
  if (!Number.isFinite(ms)) return '';
  return new Date(ms).toLocaleTimeString();
}

export function UserMessageCard({ message }) {
  const createdAt = message?.createdAt;
  const timeText = useMemo(() => (createdAt ? formatTime(createdAt) : ''), [createdAt]);
  const content = typeof message?.content === 'string' ? message.content : String(message?.content || '');
  const images = useMemo(() => {
    const list = Array.isArray(message?.attachments) ? message.attachments : [];
    return list.filter(
      (att) =>
        att?.type === 'image' &&
        typeof att?.dataUrl === 'string' &&
        att.dataUrl.startsWith('data:image/')
    );
  }, [message?.attachments]);

  return (
    <Card
      key={normalizeId(message?.id) || `user_${createdAt || ''}`}
      size="small"
      styles={{ body: { padding: 12 } }}
      style={{ borderRadius: 10 }}
      title={
        <Space size={8}>
          <Tag color="blue">你</Tag>
          {timeText ? <Text type="secondary">{timeText}</Text> : null}
        </Space>
      }
    >
      {content ? <MarkdownBlock text={content} alwaysExpanded /> : images.length > 0 ? null : <Text type="secondary">（空）</Text>}
      {images.length > 0 ? (
        <div style={{ marginTop: content ? 10 : 0, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {images.map((img) => (
            <a
              key={normalizeId(img.id) || img.dataUrl}
              href={img.dataUrl}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'inline-block' }}
            >
              <img
                src={img.dataUrl}
                alt={img.name || 'image'}
                style={{
                  maxWidth: 240,
                  maxHeight: 180,
                  borderRadius: 10,
                  border: '1px solid var(--ds-panel-border)',
                  background: 'var(--ds-panel-bg)',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            </a>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

