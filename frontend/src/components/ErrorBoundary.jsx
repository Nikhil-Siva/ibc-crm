import React from 'react';
import { Result, Button } from 'antd';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="warning"
          title="This page encountered an error"
          subTitle={
            <div>
              <p>{this.state.error?.message || 'An unexpected error occurred.'}</p>
              <code style={{ fontSize: 11, color: '#999' }}>
                {this.state.error?.stack?.split('\n')[1] || ''}
              </code>
            </div>
          }
          extra={
            <Button
              type="primary"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
            >
              Reload Page
            </Button>
          }
        />
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
