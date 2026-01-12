import React from 'react';
import { Button, Input, Space } from 'antd';
import { PauseCircleOutlined, SendOutlined } from '@ant-design/icons';

export function ChatComposer({ value, onChange, onSend, onStop, sending }) {
  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <Input.TextArea
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder="输入消息，Enter 发送（Shift+Enter 换行）"
        autoSize={{ minRows: 2, maxRows: 6 }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          if (e.shiftKey) return;
          e.preventDefault();
          onSend?.();
        }}
        disabled={sending}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Button icon={<PauseCircleOutlined />} onClick={() => onStop?.()} disabled={!sending}>
          停止
        </Button>
        <Button type="primary" icon={<SendOutlined />} onClick={() => onSend?.()} disabled={sending || !String(value || '').trim()}>
          发送
        </Button>
      </div>
    </Space>
  );
}

