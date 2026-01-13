import React, { useEffect, useState } from 'react';
import { Button, Input, Space, Tag, Typography } from 'antd';
import { CloseCircleOutlined, FolderOpenOutlined } from '@ant-design/icons';

const { Text } = Typography;
const { Search } = Input;

function normalizePath(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function ChatSessionHeader({ session, streaming, onPickWorkspaceRoot, onSetWorkspaceRoot, onClearWorkspaceRoot }) {
  const [draft, setDraft] = useState('');

  useEffect(() => {
    setDraft(normalizePath(session?.workspaceRoot));
  }, [session?.id, session?.workspaceRoot]);

  const title = session?.title || 'Chat';
  const workspaceRoot = normalizePath(session?.workspaceRoot);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontWeight: 650, fontSize: 16, lineHeight: '22px' }}>{title}</div>
        <Space size={8} wrap>
          <Button size="small" icon={<FolderOpenOutlined />} onClick={() => onPickWorkspaceRoot?.()} disabled={streaming}>
            选择目录
          </Button>
          <Button size="small" icon={<CloseCircleOutlined />} onClick={() => onClearWorkspaceRoot?.()} disabled={streaming || !workspaceRoot}>
            清除
          </Button>
        </Space>
      </div>

      <Space wrap size={6} style={{ marginTop: 10 }}>
        <Tag color="blue" style={{ marginRight: 0 }}>
          cwd
        </Tag>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {workspaceRoot || '默认（App 启动目录）'}
        </Text>
      </Space>

      <div style={{ marginTop: 10 }}>
        <Search
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onSearch={(value) => onSetWorkspaceRoot?.(value)}
          enterButton="应用"
          placeholder="手动输入工作目录路径（绝对路径）"
          disabled={streaming}
        />
      </div>

      <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
        该会话的 MCP 工具会以此目录作为 root。
      </Text>
    </div>
  );
}

