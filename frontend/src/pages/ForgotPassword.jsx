import React, { useState } from 'react';
import { Card, Form, Input, Button, Typography, Divider, Alert, Steps } from 'antd';
import {
  MailOutlined,
  LockOutlined,
  SafetyOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { message } from 'antd';

const { Text } = Typography;

const ForgotPassword = () => {
  const { forgotPassword, verifyOtp, resetPassword } = useAuth();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(0);
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [emailForm] = Form.useForm();
  const [otpForm] = Form.useForm();
  const [resetForm] = Form.useForm();

  // Step 0 — Send OTP
  const handleSendOtp = async (values) => {
    setLoading(true);
    setError('');
    const result = await forgotPassword(values.email);
    setLoading(false);
    if (result.success) {
      setEmail(values.email.trim().toLowerCase());
      setCurrentStep(1);
    } else {
      setError(result.error || 'Failed to send OTP.');
    }
  };

  // Step 1 — Verify OTP
  const handleVerifyOtp = async (values) => {
    setLoading(true);
    setError('');
    const result = await verifyOtp(email, values.otp);
    setLoading(false);
    if (result.success) {
      setResetToken(result.resetToken);
      setCurrentStep(2);
    } else {
      setError(result.error || 'Invalid OTP.');
    }
  };

  // Step 1 — Resend OTP
  const handleResendOtp = async () => {
    setLoading(true);
    setError('');
    const result = await forgotPassword(email);
    setLoading(false);
    if (result.success) {
      message.success('OTP resent successfully.');
    } else {
      setError(result.error || 'Failed to resend OTP.');
    }
  };

  // Step 2 — Reset Password
  const handleResetPassword = async (values) => {
    setLoading(true);
    setError('');
    const result = await resetPassword(resetToken, values.newPassword);
    setLoading(false);
    if (result.success) {
      message.success('Password reset! Please log in.');
      navigate('/login');
    } else {
      setError(result.error || 'Failed to reset password.');
    }
  };

  const steps = [
    { title: 'Email', icon: <MailOutlined /> },
    { title: 'Verify OTP', icon: <SafetyOutlined /> },
    { title: 'New Password', icon: <LockOutlined /> },
  ];

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
          <Text type="secondary" style={{ fontSize: 12, letterSpacing: 1 }}>RESET YOUR PASSWORD</Text>
        </Divider>

        {/* Steps Indicator */}
        <Steps
          current={currentStep}
          items={steps}
          size="small"
          style={{ marginBottom: 28 }}
        />

        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            closable
            onClose={() => setError('')}
            style={{ marginBottom: 16, borderRadius: 8 }}
          />
        )}

        {/* ─── Step 0: Enter Email ─── */}
        {currentStep === 0 && (
          <Form
            form={emailForm}
            name="forgot-email"
            onFinish={handleSendOtp}
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
                placeholder="Registered email address"
                autoFocus
              />
            </Form.Item>
            <Form.Item style={{ marginBottom: 12 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loading}
              >
                Send OTP
              </Button>
            </Form.Item>
          </Form>
        )}

        {/* ─── Step 1: Enter OTP ─── */}
        {currentStep === 1 && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 16, color: '#aaa', fontSize: 13 }}>
              OTP sent to <strong style={{ color: 'var(--c-accent)' }}>{email}</strong>
            </div>
            <Form
              form={otpForm}
              name="forgot-otp"
              onFinish={handleVerifyOtp}
              size="large"
              className="login-form"
              autoComplete="off"
            >
              <Form.Item
                name="otp"
                rules={[
                  { required: true, message: 'Please enter the OTP' },
                  { len: 6, message: 'OTP must be 6 digits' },
                  { pattern: /^\d{6}$/, message: 'OTP must be numeric' },
                ]}
              >
                <Input
                  prefix={<SafetyOutlined style={{ color: '#bbb' }} />}
                  placeholder="6-digit OTP"
                  maxLength={6}
                  autoFocus
                />
              </Form.Item>
              <Form.Item style={{ marginBottom: 12 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={loading}
                >
                  Verify OTP
                </Button>
              </Form.Item>
            </Form>
            <div style={{ textAlign: 'center', marginTop: 4 }}>
              <Button
                type="link"
                size="small"
                onClick={handleResendOtp}
                loading={loading}
                style={{ color: 'var(--c-accent)', fontSize: 13, padding: 0 }}
              >
                Resend OTP
              </Button>
            </div>
          </>
        )}

        {/* ─── Step 2: Reset Password ─── */}
        {currentStep === 2 && (
          <Form
            form={resetForm}
            name="reset-password"
            onFinish={handleResetPassword}
            size="large"
            className="login-form"
            autoComplete="off"
          >
            <Form.Item
              name="newPassword"
              rules={[
                { required: true, message: 'Please enter a new password' },
                { min: 8, message: 'Password must be at least 8 characters' },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#bbb' }} />}
                placeholder="New Password (min. 8 characters)"
                autoFocus
              />
            </Form.Item>
            <Form.Item
              name="confirmPassword"
              dependencies={['newPassword']}
              rules={[
                { required: true, message: 'Please confirm your new password' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('Passwords do not match'));
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#bbb' }} />}
                placeholder="Confirm New Password"
              />
            </Form.Item>
            <Form.Item style={{ marginBottom: 12 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loading}
                icon={<CheckCircleOutlined />}
              >
                Reset Password
              </Button>
            </Form.Item>
          </Form>
        )}

        {/* Back to Login */}
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Link to="/login" style={{ color: 'var(--c-accent)', fontSize: 13 }}>← Back to Sign In</Link>
        </div>
      </Card>
    </div>
  );
};

export default ForgotPassword;
