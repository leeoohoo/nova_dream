import React from 'react';
import { Alert, Card, Layout, Spin } from 'antd';

import { hasApi } from '../../lib/api.js';
import { ChatSidebar } from './components/ChatSidebar.jsx';
import { ChatSessionHeader } from './components/ChatSessionHeader.jsx';
import { ChatMessages } from './components/ChatMessages.jsx';
import { ChatComposer } from './components/ChatComposer.jsx';
import { useChatController } from './hooks/useChatController.js';

const { Sider, Content } = Layout;

export function ChatView({ admin }) {
  const controller = useChatController({ admin });
  const {
    loading,
    agents,
    sessions,
    messages,
    messagesHasMore,
    loadingMore,
    selectedAgentId,
    selectedSessionId,
    composerText,
    streamState,
    currentSession,
    setComposerText,
    refreshAll,
    selectSession,
    loadMoreMessages,
    createSession,
    deleteSession,
    renameSession,
    changeAgent,
    setWorkspaceRoot,
    pickWorkspaceRoot,
    clearWorkspaceRoot,
    sendMessage,
    stopStreaming,
  } = controller;

  if (!hasApi) {
    return <Alert type="error" message="IPC bridge not available. Is preload loaded?" />;
  }

  if (loading) {
    return (
      <div style={{ padding: 18 }}>
        <Spin />
      </div>
    );
  }

  return (
    <>
      <Layout style={{ height: '100%', minHeight: 0 }}>
        <Sider width={320} style={{ background: 'var(--ds-panel-bg)', borderRight: '1px solid var(--ds-panel-border)' }}>
          <ChatSidebar
            agents={agents}
            sessions={sessions}
            selectedAgentId={selectedAgentId}
            selectedSessionId={selectedSessionId}
            streaming={Boolean(streamState)}
            onAgentChange={async (agentId) => {
              try {
                await changeAgent(agentId);
              } catch {
                // changeAgent already toasts
              }
            }}
            onSelectSession={selectSession}
            onCreateSession={async () => {
              try {
                await createSession();
              } catch {
                // createSession already toasts
              }
            }}
            onDeleteSession={async (sid) => {
              try {
                await deleteSession(sid);
              } catch {
                // deleteSession already toasts
              }
            }}
            onRenameSession={async (sid, title) => {
              try {
                await renameSession(sid, title);
              } catch {
                // renameSession already toasts
              }
            }}
            onRefresh={refreshAll}
          />
        </Sider>
        <Content
          style={{
            padding: 16,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            minHeight: 0,
          }}
        >
          <ChatSessionHeader
            session={currentSession}
            streaming={Boolean(streamState)}
            onPickWorkspaceRoot={pickWorkspaceRoot}
            onSetWorkspaceRoot={setWorkspaceRoot}
            onClearWorkspaceRoot={clearWorkspaceRoot}
          />

          <Card size="small" style={{ flex: 1, minHeight: 0, borderRadius: 14 }} styles={{ body: { padding: 0, height: '100%' } }}>
            <div style={{ height: '100%', minHeight: 0, padding: 12 }}>
              <ChatMessages
                messages={messages}
                streaming={streamState}
                hasMore={messagesHasMore}
                loadingMore={loadingMore}
                onLoadMore={loadMoreMessages}
              />
            </div>
          </Card>

          <Card size="small" style={{ borderRadius: 14 }} styles={{ body: { padding: 12 } }}>
            <ChatComposer
              value={composerText}
              onChange={setComposerText}
              onSend={async () => {
                try {
                  await sendMessage();
                } catch {
                  // sendMessage already toasts
                }
              }}
              onStop={stopStreaming}
              sending={Boolean(streamState)}
            />
          </Card>
        </Content>
      </Layout>
    </>
  );
}
