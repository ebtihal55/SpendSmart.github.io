import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { login } from '../services/auth';
import '../styles/Auth.css';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password);
      toast.success('Successfully logged in!');
      navigate('/');
    } catch (error) {
      toast.error(error.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="login auth-form-side">
        <div className="auth-logo">
          <Link to="/">
            <i className="fa-solid fa-wallet"> SpendSmart</i>
          </Link>
        </div>
        
        <div className="auth-form-container">
          <div className="auth-title">
            <h1>Log in to Your Account</h1>
            <p>Log in to your account so you can start saving today.</p>
          </div>

          <form className="auth-form" onSubmit={handleLogin}>
            <div className="form-group">
              <input
                type="email"
                className="form-control"
                id="email"
                placeholder=" "
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <label className="form-label" htmlFor="email">Email address</label>
            </div>

            <div className="form-group">
              <input
                type="password"
                className="form-control"
                id="password"
                placeholder=" "
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <label className="form-label" htmlFor="password">Password</label>
            </div>

            <div className="auth-links">
              <label className="remember-me">
                <input type="checkbox" />
                <span>Remember me</span>
              </label>
              <Link to="/forgot-password" className="forgot-password">
                Forgot password?
              </Link>
            </div>

            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </form>
        </div>
      </div>

      <div className="signup auth-cta-side">
        <div className="auth-cta-content">
          <h2 className="auth-cta-title">Don't Have an Account Yet?</h2>
          <p className="auth-cta-text">
            Sign up today and unlock smarter ways to save on every purchase!
          </p>
          <Link to="/signup">
            <button className="cta-button">SIGN UP</button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Login;