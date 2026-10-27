import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('stockpilot_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('stockpilot_token');
    if (token) {
      api.me()
        .then((data) => {
          setUser(data.user);
          localStorage.setItem('stockpilot_user', JSON.stringify(data.user));
        })
        .catch(() => {
          localStorage.removeItem('stockpilot_token');
          localStorage.removeItem('stockpilot_user');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const data = await api.login(username, password);
    localStorage.setItem('stockpilot_token', data.token);
    localStorage.setItem('stockpilot_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('stockpilot_token');
    localStorage.removeItem('stockpilot_user');
    setUser(null);
  };

  const isManager = user?.role === 'manager';

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isManager }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
