import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import App from './App';
import theme from './theme';
import './index.css';

// The theme lives in theme.js so it stays next to styles/tokens.css — those two
// are the only places a raw colour value is allowed.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider theme={theme}>
      <App />
    </ConfigProvider>
  </React.StrictMode>
);
