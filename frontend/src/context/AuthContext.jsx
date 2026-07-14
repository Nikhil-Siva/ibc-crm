import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import api from '../api/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('crm_token'));
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      const storedToken = localStorage.getItem('crm_token');
      if (storedToken) {
        try {
          const response = await api.get('/auth/me');
          // Handle both response formats: { data: user } and { user }
          const userData = response.data?.data || response.data?.user || response.data;
          setUser(userData);
          setToken(storedToken);
        } catch (err) {
          console.error('Token validation failed:', err);
          localStorage.removeItem('crm_token');
          localStorage.removeItem('crm_user');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };
    validateToken();
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const response = await api.post('/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      });

      const responseData = response.data;

      // Handle both response shapes:
      // Shape A: { success: true, data: { token, user } }
      // Shape B: { success: true, token, user }
      const token = responseData?.data?.token || responseData?.token;
      const userData = responseData?.data?.user || responseData?.user;

      if (!token || !userData) {
        console.error('[LOGIN] Unexpected response shape:', responseData);
        return { success: false, error: 'Unexpected server response. Please try again.' };
      }

      localStorage.setItem('crm_token', token);
      localStorage.setItem('crm_user', JSON.stringify(userData));
      setToken(token);
      setUser(userData);

      message.success(`Welcome back, ${userData.name || userData.email}!`);
      if (userData.role === 'agent') {
        navigate('/telecaller-dashboard');
      } else {
        navigate('/dashboard');
      }
      return { success: true };

    } catch (err) {
      console.error('[LOGIN] Error:', err);
      let errorMsg = 'Login failed. Please check your credentials.';

      if (err.response) {
        // Server responded with an error
        errorMsg = err.response.data?.message || errorMsg;
        console.error('[LOGIN] Server error response:', err.response.data);
      } else if (err.request) {
        // No response received — server is likely not running
        errorMsg = 'Cannot connect to server. Make sure the backend is running on port 5000.';
      }

      return { success: false, error: errorMsg };
    }
  }, [navigate]);

  const logout = useCallback(() => {
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
    setToken(null);
    setUser(null);
    message.info('You have been logged out.');
    navigate('/login');
  }, [navigate]);

  // signup(data) — calls POST /api/auth/register
  const signup = useCallback(async ({ name, email, mobile, password, role }) => {
    try {
      const response = await api.post('/auth/register', { name, email: email.trim().toLowerCase(), mobile, password, role: role || 'agent' });
      return { success: true, message: 'Account created successfully. Please log in.' };
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Registration failed. Please try again.';
      return { success: false, error: errorMsg };
    }
  }, []);

  // forgotPassword(email) — calls POST /api/auth/forgot-password
  const forgotPassword = useCallback(async (email) => {
    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.message || 'Failed to send OTP.' };
    }
  }, []);

  // verifyOtp(email, otp) — calls POST /api/auth/verify-otp
  const verifyOtp = useCallback(async (email, otp) => {
    try {
      const response = await api.post('/auth/verify-otp', { email: email.trim().toLowerCase(), otp });
      const resetToken = response.data?.data?.resetToken;
      return { success: true, resetToken };
    } catch (err) {
      return { success: false, error: err.response?.data?.message || 'Invalid OTP.' };
    }
  }, []);

  // resetPassword(resetToken, newPassword) — calls POST /api/auth/reset-password
  const resetPassword = useCallback(async (resetToken, newPassword) => {
    try {
      await api.post('/auth/reset-password', { resetToken, newPassword });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.message || 'Failed to reset password.' };
    }
  }, []);

  const isAuthenticated = !!token && !!user;

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    isAuthenticated,
    signup,
    forgotPassword,
    verifyOtp,
    resetPassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
