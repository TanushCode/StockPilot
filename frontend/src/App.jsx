import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import api from './api';

import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Inventory from './pages/Inventory';
import Movements from './pages/Movements';
import Alerts from './pages/Alerts';
import Reorder from './pages/Reorder';
import FilesCloud from './pages/FilesCloud';

function ProtectedLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  const fetchUnread = () => {
    if (!user) return;
    api.dashboard()
      .then((data) => setUnreadAlerts(data.unread_alerts || 0))
      .catch(() => {});
  };

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, [user, location.pathname]);

  if (loading) {
    return (
      <div className="loading-page" style={{ height: '100vh' }}>
        <div className="spinner"></div>
        <p>Connecting to StockPilot Cloud...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <div className="app-layout">
      <Sidebar unreadAlerts={unreadAlerts} />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/products" element={<Products />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/movements" element={<Movements />} />
          <Route path="/alerts" element={<Alerts onAlertsChanged={fetchUnread} />} />
          <Route path="/reorder" element={<Reorder />} />
          <Route path="/cloud" element={<FilesCloud />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="loading-page" style={{ height: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }
  if (user) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
