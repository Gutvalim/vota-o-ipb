import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface AppUser {
  username: string;
  password: string;
  approved: boolean;
  isAdmin: boolean;
}

interface AuthState {
  currentUser: AppUser | null;
  users: AppUser[];
}

interface AuthContextType {
  currentUser: AppUser | null;
  users: AppUser[];
  login: (username: string, password: string) => { success: boolean; message: string };
  register: (username: string, password: string) => { success: boolean; message: string };
  logout: () => void;
  approveUser: (username: string) => void;
  rejectUser: (username: string) => void;
}

const STORAGE_KEY = 'ipb-auth';

const defaultUsers: AppUser[] = [
  { username: 'ipbnb', password: 'luterocalvino', approved: true, isAdmin: true },
];

function loadState(): AuthState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure default user always exists
      const hasDefault = parsed.users?.some((u: AppUser) => u.username === 'ipbnb');
      if (!hasDefault) {
        parsed.users = [...defaultUsers, ...(parsed.users || [])];
      }
      return parsed;
    }
  } catch {}
  return { currentUser: null, users: [...defaultUsers] };
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const login = (username: string, password: string) => {
    const user = state.users.find(u => u.username === username && u.password === password);
    if (!user) return { success: false, message: 'Usuário ou senha incorretos.' };
    if (!user.approved) return { success: false, message: 'Seu cadastro ainda não foi aprovado por um administrador.' };
    setState(s => ({ ...s, currentUser: user }));
    return { success: true, message: '' };
  };

  const register = (username: string, password: string) => {
    if (username.length < 3) return { success: false, message: 'Usuário deve ter pelo menos 3 caracteres.' };
    if (password.length < 6) return { success: false, message: 'Senha deve ter pelo menos 6 caracteres.' };
    if (state.users.some(u => u.username === username)) return { success: false, message: 'Este usuário já existe.' };
    const newUser: AppUser = { username, password, approved: false, isAdmin: false };
    setState(s => ({ ...s, users: [...s.users, newUser] }));
    return { success: true, message: 'Cadastro realizado! Aguarde aprovação do administrador.' };
  };

  const logout = () => setState(s => ({ ...s, currentUser: null }));

  const approveUser = (username: string) => {
    setState(s => ({
      ...s,
      users: s.users.map(u => u.username === username ? { ...u, approved: true } : u),
    }));
  };

  const rejectUser = (username: string) => {
    setState(s => ({
      ...s,
      users: s.users.filter(u => u.username !== username),
    }));
  };

  return (
    <AuthContext.Provider value={{ currentUser: state.currentUser, users: state.users, login, register, logout, approveUser, rejectUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
