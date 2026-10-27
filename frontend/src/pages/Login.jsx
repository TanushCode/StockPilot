import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  UserCheck,
  ArrowRight,
  AlertCircle,
  Server,
  Database,
  CheckCircle2,
  Sun,
  Moon,
  Sparkles,
} from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('stockpilot_theme') === 'dark';
  });

  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('stockpilot_theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('stockpilot_theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!username || !password) {
      setError('Please provide both username and password');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const fillAndLogin = (u, p) => {
    setUsername(u);
    setPassword(p);
    setError('');
    setSubmitting(true);
    login(u, p)
      .then(() => navigate('/'))
      .catch((err) => setError(err.message || 'Login failed'))
      .finally(() => setSubmitting(false));
  };

  return (
    <div className="login-split-container">
      {/* Left Showcase Panel (46%) — Sahara Warm Minimalism */}
      <div className="login-left-showcase">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="sidebar-logo" style={{ width: 42, height: 42, fontSize: '1.35rem' }}>
              SP
            </div>
            <div>
              <div style={{ fontFamily: 'EB Garamond, Georgia, serif', fontSize: '1.6rem', fontWeight: 600, letterSpacing: '-0.01em', color: '#faf5ee' }}>
                StockPilot
              </div>
              <div style={{ fontSize: '0.72rem', color: '#c5bbb0', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
                Sun-Baked Simplicity
              </div>
            </div>
          </div>

          <h2 style={{ fontSize: '2.5rem', fontWeight: 600, lineHeight: 1.2, marginBottom: '20px', letterSpacing: '-0.02em', color: '#faf5ee' }}>
            Curated Inventory & Expiry Control
          </h2>
          <p style={{ color: '#c5bbb0', fontSize: '1rem', lineHeight: 1.65, maxWidth: '440px', fontWeight: 400 }}>
            Luxurious warmth meets disciplined minimalism. Automated First-Expired, First-Out (FEFO) batch rotation and real-time replenishment powered by AWS Cloud infrastructure.
          </p>

          {/* Stylized FEFO Preview Card (Sahara Tone) */}
          <div
            style={{
              marginTop: '44px',
              padding: '24px',
              borderRadius: 'var(--radius-lg)',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(216, 208, 200, 0.14)',
              backdropFilter: 'blur(10px)',
              maxWidth: '430px',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#d9773b', fontWeight: 700 }}>
                Automated FEFO Rotation
              </span>
              <span className="badge" style={{ background: 'var(--brand-primary)', color: '#ffffff', fontSize: '0.68rem', padding: '2px 8px' }}>
                Live Algorithm
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(194, 101, 42, 0.22)',
                  border: '1px solid var(--brand-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.85rem',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: '#faf5ee' }}>LOT-DAIRY-801 (Amul Butter)</div>
                  <div style={{ fontSize: '0.72rem', color: '#fbeee4' }}>Expires in 4 days</div>
                </div>
                <span className="badge" style={{ background: '#c2652a', color: '#ffffff', fontWeight: 700 }}>
                  FEFO Priority #1
                </span>
              </div>

              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(216, 208, 200, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.85rem',
                  opacity: 0.75,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: '#faf5ee' }}>LOT-DAIRY-890 (Amul Butter)</div>
                  <div style={{ fontSize: '0.72rem', color: '#a49789' }}>Expires in 28 days</div>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#a49789' }}>Standby #2</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cloud Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', paddingTop: '36px' }}>
          <div className="flex items-center gap-2" style={{ fontSize: '0.78rem', color: '#c5bbb0' }}>
            <Server size={16} color="#d9773b" />
            <span>Amazon EC2 Compute</span>
          </div>
          <div className="flex items-center gap-2" style={{ fontSize: '0.78rem', color: '#c5bbb0' }}>
            <Database size={16} color="#d9773b" />
            <span>Amazon RDS MySQL</span>
          </div>
          <div className="flex items-center gap-2" style={{ fontSize: '0.78rem', color: '#c5bbb0' }}>
            <CheckCircle2 size={16} color="#d9773b" />
            <span>99.98% Accuracy</span>
          </div>
        </div>
      </div>

      {/* Right Form Container (54%) with Universal Dark Mode Toggle */}
      <div className="login-right-form">
        {/* Dark Mode Switcher on Login Page */}
        <button
          onClick={toggleTheme}
          className="btn-secondary btn-icon"
          title="Toggle light / dark mode"
          style={{
            position: 'absolute',
            top: 24,
            right: 28,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {isDark ? <Sun size={17} color="#d9773b" /> : <Moon size={17} color="var(--brand-primary)" />}
        </button>

        <div className="login-card-inner">
          <div className="mb-6">
            <h1 style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Welcome to StockPilot
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: 4 }}>
              Enter your store credentials or choose an evaluation role below.
            </p>
          </div>

          {/* 1-Click Evaluation Switcher Banner */}
          <div
            style={{
              marginBottom: '24px',
              padding: '14px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface-muted)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '10px' }}>
              ⚡ 1-Click Evaluation Demo Switcher
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm flex-1"
                style={{ justifyContent: 'flex-start' }}
                onClick={() => fillAndLogin('manager', 'manager123')}
                disabled={submitting}
              >
                <ShieldCheck size={15} color="var(--brand-primary)" />
                <span>Store Manager</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm flex-1"
                style={{ justifyContent: 'flex-start' }}
                onClick={() => fillAndLogin('staff', 'staff123')}
                disabled={submitting}
              >
                <UserCheck size={15} color="#8c3c3c" />
                <span>Floor Staff</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="alert-banner error mb-4">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="username">
                Username / Identifier
              </label>
              <input
                id="username"
                type="text"
                className="form-input"
                placeholder="manager or staff"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              style={{ padding: '12px', marginTop: '10px', fontSize: '0.92rem' }}
              disabled={submitting}
            >
              {submitting ? 'Authenticating...' : 'Sign In to Workspace'}
              <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
