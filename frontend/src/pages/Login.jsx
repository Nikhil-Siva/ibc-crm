import React, { useState } from 'react';
import { Card, Form, Input, Button, Typography, Divider, Alert } from 'antd';
import { MailOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { Navigate, Link } from 'react-router-dom';

const { Title, Text } = Typography;

const Login = () => {
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (authLoading) {
    return null; // or a spinner
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (values) => {
    setLoading(true);
    setError('');
    try {
      const result = await login(values.email, values.password);
      if (!result.success) {
        setError(result.error || 'Login failed');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <Card className="login-card" bordered={false}>
        {/* Header / Logo */}
        <div className="login-header">
          <div className="brand-name">IBC</div>
          <div className="brand-subtitle">Invic Business Corp LLP</div>
          <div className="brand-tagline">Insurance CRM Platform</div>
        </div>

        <Divider style={{ margin: '16px 0 24px' }}>
          <Text type="secondary" style={{ fontSize: 12, letterSpacing: 1 }}>SIGN IN TO CONTINUE</Text>
        </Divider>

        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            closable
            onClose={() => setError('')}
            style={{ marginBottom: 20, borderRadius: 8 }}
          />
        )}

        <Form
          name="login"
          onFinish={handleLogin}
          size="large"
          className="login-form"
          autoComplete="off"
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email' },
            ]}
          >
            <Input
              prefix={<MailOutlined style={{ color: '#bbb' }} />}
              placeholder="Email address"
              autoFocus
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: 'Please enter your password' },
              { min: 6, message: 'Password must be at least 6 characters' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#bbb' }} />}
              placeholder="Password"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 12 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              icon={<LoginOutlined />}
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>

        {/* Links */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <Link to="/forgot-password" style={{ color: 'var(--c-accent)', fontSize: 13 }}>Forgot Password?</Link>
          <span style={{ margin: '0 12px', color: '#ddd' }}>|</span>
          <Link to="/signup" style={{ color: 'var(--c-accent)', fontSize: 13 }}>Create Account</Link>
        </div>

        {/* Demo Credentials */}
        <div className="demo-credentials">
          <div className="demo-title">Demo Credentials</div>
          <div style={{ marginTop: 4 }}>
            <code>admin@insurancecrm.com</code>
            <span style={{ margin: '0 6px', color: '#ccc' }}>|</span>
            <code>Admin@123</code>
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: '#aaa' }}>Telecaller: agent@insurancecrm.com | Agent@123</div>
        </div>
      </Card>
    </div>
  );
};

export default Login;
