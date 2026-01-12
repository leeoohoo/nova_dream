import React, { useMemo } from 'react';
import { Alert, Layout, Spin } from 'antd';

import { hasApi } from '../../lib/api.js';
import { ChatSidebar } from './components/ChatSidebar.jsx';
import { ChatSessionHeader } from './components/ChatSessionHeader.jsx';
import { ChatMessages } from './components/ChatMessages.jsx';
import { ChatComposer } from './components/ChatComposer.jsx';
import { useChatController } from './hooks/useChatController.js';

const { Sider, Content } = Layout;

function normalizeId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

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
    composerAttachments,
    streamState,
    currentSession,
    setComposerText,
    setComposerAttachments,
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

  const models = useMemo(() => (Array.isArray(admin?.models) ? admin.models : []), [admin]);
  const modelById = useMemo(() => new Map(models.map((m) => [normalizeId(m?.id), m])), [models]);
  const selectedAgent = useMemo(
    () =>
      Array.isArray(agents)
        ? agents.find((a) => normalizeId(a?.id) === normalizeId(selectedAgentId)) || null
        : null,
    [agents, selectedAgentId]
  );
  const selectedModel = useMemo(
    () => (selectedAgent ? modelById.get(normalizeId(selectedAgent.modelId)) : null),
    [modelById, selectedAgent]
  );
  const visionEnabled = Boolean(selectedModel?.supportsVision);

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
            minHeight: 0,
          }}
        >
          <div
            style={{
              flex: 1,
              minHeight: 0,
              borderRadius: 16,
              overflow: 'hidden',
              background: 'var(--ds-panel-bg)',
              border: '1px solid var(--ds-panel-border)',
              boxShadow: 'var(--ds-panel-shadow)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ padding: 12, borderBottom: '1px solid var(--ds-panel-border)', background: 'var(--ds-subtle-bg)' }}>
              <ChatSessionHeader
                session={currentSession}
                streaming={Boolean(streamState)}
                onPickWorkspaceRoot={pickWorkspaceRoot}
                onSetWorkspaceRoot={setWorkspaceRoot}
                onClearWorkspaceRoot={clearWorkspaceRoot}
              />
            </div>

            <div style={{ flex: 1, minHeight: 0, padding: 12 }}>
              <ChatMessages
                messages={messages}
                streaming={streamState}
                hasMore={messagesHasMore}
                loadingMore={loadingMore}
                onLoadMore={loadMoreMessages}
              />
            </div>

            <div style={{ padding: 12, borderTop: '1px solid var(--ds-panel-border)', background: 'var(--ds-subtle-bg)' }}>
            <ChatComposer
              value={composerText}
              onChange={setComposerText}
              attachments={composerAttachments}
              onAttachmentsChange={setComposerAttachments}
              visionEnabled={visionEnabled}
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
            </div>
          </div>
        </Content>
      </Layout>
    </>
  );
}
