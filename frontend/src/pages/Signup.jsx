import React, { useState } from 'react';
import { Card, Form, Input, Button, Typography, Divider, Alert, Select } from 'antd';
import {
  UserOutlined,
  MailOutlined,
  LockOutlined,
  PhoneOutlined,
  TeamOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { Navigate, Link } from 'react-router-dom';
import { message } from 'antd';

const { Text } = Typography;
const { Option } = Select;

const Signup = () => {
  const { signup, isAuthenticated, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form] = Form.useForm();

  if (authLoading) return null;

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSignup = async (values) => {
    setLoading(true);
    setError('');
    try {
      const result = await signup({
        name: values.name,
        email: values.email,
        mobile: values.mobile,
        password: values.password,
        role: values.role || 'agent',
      });
      if (result.success) {
        message.success(result.message || 'Account created successfully. Please log in.');
        form.resetFields();
      } else {
        setError(result.error || 'Registration failed. Please try again.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <Card className="login-card" bordered={false} style={{ maxWidth: 440 }}>
        {/* Header / Logo */}
        <div className="login-header">
          <div className="brand-name">IBC</div>
          <div className="brand-subtitle">Invic Business Corp LLP</div>
          <div className="brand-tagline">Insurance CRM Platform</div>
        </div>

        <Divider style={{ margin: '16px 0 20px' }}>
          <Text type="secondary" style={{ fontSize: 12, letterSpacing: 1 }}>CREATE YOUR ACCOUNT</Text>
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
          form={form}
          name="signup"
          onFinish={handleSignup}
          size="large"
          className="login-form"
          autoComplete="off"
          initialValues={{ role: 'agent' }}
        >
          {/* Full Name */}
          <Form.Item
            name="name"
            rules={[{ required: true, message: 'Please enter your full name' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#bbb' }} />}
              placeholder="Full Name"
              autoFocus
            />
          </Form.Item>

          {/* Email */}
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
            />
          </Form.Item>

          {/* Mobile */}
          <Form.Item
            name="mobile"
            rules={[
              { required: true, message: 'Please enter your mobile number' },
              { pattern: /^\d{10}$/, message: 'Mobile number must be exactly 10 digits' },
            ]}
          >
            <Input
              prefix={<PhoneOutlined style={{ color: '#bbb' }} />}
              placeholder="Mobile (10 digits)"
              maxLength={10}
            />
          </Form.Item>

          {/* Password */}
          <Form.Item
            name="password"
            rules={[
              { required: true, message: 'Please enter a password' },
              { min: 6, message: 'Password must be at least 6 characters' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#bbb' }} />}
              placeholder="Password (min. 6 characters)"
            />
          </Form.Item>

          {/* Confirm Password */}
          <Form.Item
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: 'Please confirm your password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Passwords do not match'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#bbb' }} />}
              placeholder="Confirm Password"
            />
          </Form.Item>

          {/* Role */}
          <Form.Item name="role" rules={[{ required: true }]}>
            <Select
              placeholder="Select Role"
              suffixIcon={<TeamOutlined style={{ color: '#bbb' }} />}
            >
              <Option value="agent">Telecaller</Option>
              <Option value="admin">Admin</Option>
            </Select>
          </Form.Item>

          <Form.Item style={{ marginBottom: 12 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              icon={<UserAddOutlined />}
            >
              Create Account
            </Button>
          </Form.Item>
        </Form>

        {/* Back to Login */}
        <div style={{ textAlign: 'center', marginTop: 4 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>Already have an account? </Text>
          <Link to="/login" style={{ color: 'var(--c-accent)', fontSize: 13, fontWeight: 500 }}>
            Sign In
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default Signup;
