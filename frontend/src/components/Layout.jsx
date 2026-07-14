import React, { useState } from 'react';
import { Layout as AntLayout } from 'antd';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

const { Sider, Header, Content, Footer } = AntLayout;

// AntD's Sider needs real numbers, so these mirror --sidebar-w / --topbar-h
// in styles/tokens.css. Change both together.
const SIDEBAR_WIDTH = 240;
const SIDEBAR_WIDTH_COLLAPSED = 72;
const TOPBAR_HEIGHT = 56;

const Layout = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={SIDEBAR_WIDTH}
        collapsedWidth={SIDEBAR_WIDTH_COLLAPSED}
        className="sidebar-container"
        breakpoint="lg"
        trigger={null}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
        }}
      >
        <Sidebar collapsed={collapsed} />
      </Sider>
      <AntLayout
        style={{
          marginLeft: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH,
          transition: 'margin-left 180ms ease',
        }}
      >
        <Header style={{ padding: 0, height: TOPBAR_HEIGHT, lineHeight: 'normal' }}>
          <TopBar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        </Header>
        {/* No fade class: content shouldn't animate in on every navigation. */}
        <Content className="main-content">
          {children}
        </Content>
        <Footer className="content-footer">
          Invic Business Corp LLP © {new Date().getFullYear()} — Insurance CRM Platform
        </Footer>
      </AntLayout>
    </AntLayout>
  );
};

export default Layout;
