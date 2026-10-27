import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Package,
  Boxes,
  ArrowLeftRight,
  AlertTriangle,
  TrendingUp,
  Cloud,
  LogOut,
  Shield,
  User,
  Sun,
  Moon,
} from 'lucide-react';

export default function Sidebar({ unreadAlerts = 0 }) {
  const { user, logout, isManager } = useAuth();
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('stockpilot_theme') === 'dark';
  });

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

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">SP</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sidebar-title">StockPilot</div>
          <div className="sidebar-subtitle">Cloud Inventory</div>
        </div>
        <button
          onClick={toggleTheme}
          className="btn-ghost btn-icon"
          title="Toggle light / dark mode"
          style={{ color: '#94A3B8' }}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-title">Core Operations</div>
        <NavLink
          to="/"
          end
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
        >
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/inventory"
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
        >
          <Boxes size={18} />
          <span>Batches & FEFO</span>
        </NavLink>

        <NavLink
          to="/products"
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
        >
          <Package size={18} />
          <span>Product Catalog</span>
        </NavLink>

        <NavLink
          to="/movements"
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
        >
          <ArrowLeftRight size={18} />
          <span>Stock Ledger</span>
        </NavLink>

        <div className="sidebar-section-title">Intelligence & Cloud</div>
        <NavLink
          to="/alerts"
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
        >
          <AlertTriangle size={18} />
          <span>Alerts Hub</span>
          {unreadAlerts > 0 && <span className="sidebar-badge">{unreadAlerts}</span>}
        </NavLink>

        <NavLink
          to="/reorder"
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
        >
          <TrendingUp size={18} />
          <span>Reorder Advisor</span>
        </NavLink>

        <NavLink
          to="/cloud"
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
        >
          <Cloud size={18} />
          <span>AWS Cloud Hub</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#FFFFFF', fontSize: '0.82rem', fontWeight: 600 }} className="truncate">
              {user?.username}
            </div>
            <div className="flex items-center gap-1" style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
              {isManager ? (
                <>
                  <Shield size={11} color="#2DD4BF" />
                  <span>Store Manager</span>
                </>
              ) : (
                <>
                  <User size={11} color="#94A3B8" />
                  <span>Floor Staff</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={logout}
            className="btn-ghost btn-icon"
            title="Log out"
            style={{ color: '#94A3B8' }}
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
