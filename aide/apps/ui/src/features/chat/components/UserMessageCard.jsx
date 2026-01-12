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
      {content ? <MarkdownBlock text={content} alwaysExpanded /> : <Text type="secondary">（空）</Text>}
    </Card>
  );
}

