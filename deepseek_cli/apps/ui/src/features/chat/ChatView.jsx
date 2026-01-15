import React, { useCallback, useMemo, useState } from 'react';
import { Button, Space, Tooltip } from 'antd';
import {
  AppstoreOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
  HomeOutlined,
} from '@ant-design/icons';

import { ChatView as BaseChatView } from '@leeoohoo/common/aide-ui/features/chat/ChatView.jsx';
import { AppsHubView } from '../apps/AppsHubView.jsx';
import { AppsPluginView } from '../apps/AppsPluginView.jsx';

const DEFAULT_DRAWER_WIDTH = 420;

function decodeRouteSegment(value) {
  if (typeof value !== 'string') return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseAppsRoute(route) {
  const raw = typeof route === 'string' ? route.trim() : '';
  if (!raw) return { type: 'unknown', route: '' };
  if (raw === 'apps' || raw === 'apps/home') return { type: 'home', route: raw };
  if (raw.startsWith('apps/plugin/')) {
    const parts = raw.split('/');
    const pluginId = decodeRouteSegment(parts[2] || '');
    const appId = decodeRouteSegment(parts[3] || '');
    if (pluginId && appId) return { type: 'app', route: raw, pluginId, appId };
  }
  return { type: 'external', route: raw };
}

export function ChatView({ admin, onNavigate }) {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [drawerFullscreen, setDrawerFullscreen] = useState(false);
  const [activeApp, setActiveApp] = useState(null);

  const showApp = Boolean(activeApp?.pluginId && activeApp?.appId);

  const handleDrawerNavigate = useCallback(
    (route) => {
      const parsed = parseAppsRoute(route);
      if (parsed.type === 'home') {
        setActiveApp(null);
        setDrawerFullscreen(false);
        setDrawerOpen(true);
        return;
      }
      if (parsed.type === 'app') {
        setActiveApp({ pluginId: parsed.pluginId, appId: parsed.appId });
        setDrawerOpen(true);
        return;
      }
      if (typeof onNavigate === 'function' && parsed.route) {
        onNavigate(parsed.route);
      }
    },
    [onNavigate]
  );

  const drawerStyle = useMemo(() => {
    const width = drawerFullscreen ? '100%' : DEFAULT_DRAWER_WIDTH;
    return {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      width,
      maxWidth: '100%',
      background: 'var(--ds-panel-bg)',
      borderLeft: drawerFullscreen ? 'none' : '1px solid var(--ds-panel-border)',
      boxShadow: 'var(--ds-panel-shadow)',
      transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.18s ease-out',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 20,
      pointerEvents: drawerOpen ? 'auto' : 'none',
    };
  }, [drawerFullscreen, drawerOpen]);

  return (
    <div style={{ position: 'relative', height: '100%', minHeight: 0 }}>
      <BaseChatView admin={admin} />

      {!drawerOpen ? (
        <Tooltip title="Apps">
          <Button
            type="primary"
            size="small"
            icon={<AppstoreOutlined />}
            onClick={() => setDrawerOpen(true)}
            style={{
              position: 'absolute',
              right: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              borderRadius: '6px 0 0 6px',
              zIndex: 10,
            }}
          />
        </Tooltip>
      ) : null}

      <div style={drawerStyle} aria-hidden={!drawerOpen}>
        <div
          style={{
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderBottom: '1px solid var(--ds-panel-border)',
            background: 'var(--ds-subtle-bg)',
          }}
        >
          <AppstoreOutlined />
          <span style={{ fontWeight: 600 }}>{showApp ? 'App' : 'Apps'}</span>
          <div style={{ flex: 1 }} />
          <Space size={6}>
            {showApp ? (
              <Tooltip title={drawerFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
                <Button
                  size="small"
                  icon={<DoubleLeftOutlined />}
                  onClick={() => setDrawerFullscreen((prev) => !prev)}
                />
              </Tooltip>
            ) : null}
            <Tooltip title="Collapse">
              <Button
                size="small"
                icon={<DoubleRightOutlined />}
                onClick={() => {
                  setDrawerOpen(false);
                  setDrawerFullscreen(false);
                }}
              />
            </Tooltip>
          </Space>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: 12 }}>
          {showApp ? (
            <AppsPluginView
              pluginId={activeApp.pluginId}
              appId={activeApp.appId}
              onNavigate={handleDrawerNavigate}
            />
          ) : (
            <AppsHubView onNavigate={handleDrawerNavigate} />
          )}
        </div>

        <div
          style={{
            padding: '10px 12px',
            borderTop: '1px solid var(--ds-panel-border)',
            background: 'var(--ds-subtle-bg)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Button
            size="small"
            icon={<HomeOutlined />}
            onClick={() => {
              setActiveApp(null);
              setDrawerFullscreen(false);
            }}
            disabled={!showApp}
          >
            Home
          </Button>
        </div>
      </div>
    </div>
  );
}
