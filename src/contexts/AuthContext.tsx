import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";

// 1. INICIALIZAÇÃO DO FIREBASE (Igual ao ElectionContext)
const firebaseConfig = {
  apiKey: "AIzaSyD5lSgqKvXFZBK8-PalruztaoZliXxT8GE",
  authDomain: "eleicao-ipb.firebaseapp.com",
  projectId: "eleicao-ipb",
  storageBucket: "eleicao-ipb.firebasestorage.app",
  messagingSenderId: "1072551138226",
  appId: "1:1072551138226:web:24b2aa1109e5bdb0c10aab"
};

// Usa o getApps() para evitar erro de "app já inicializado" caso o site recarregue rápido
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const AUTH_DOC_ID = 'main';

export interface AppUser {
  username: string;
  password: string;
  approved: boolean;
  isAdmin: boolean;
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

const STORAGE_KEY_CURRENT_USER = 'ipb-auth-current';

// Usuário Mestre que nunca pode ser apagado
const defaultUsers: AppUser[] = [
  { username: 'ipbnb', password: 'luterocalvino', approved: true, isAdmin: true },
];

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // O usuário logado atualmente fica no navegador (para não deslogar ao atualizar a página)
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // A lista de todos os usuários cadastrados vem do Firebase
  const [users, setUsers] = useState<AppUser[]>([]);

  // Sincronização da lista de usuários com o Firebase
  useEffect(() => {
    const docRef = doc(db, 'auth', AUTH_DOC_ID);
    
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        let cloudUsers: AppUser[] = data.users || [];
        
        // Garante que o usuário mestre sempre exista
        const hasDefault = cloudUsers.some(u => u.username === 'ipbnb');
        if (!hasDefault) {
          cloudUsers = [...defaultUsers, ...cloudUsers];
          setDoc(docRef, { users: cloudUsers }); // Salva a correção na nuvem
        }
        
        setUsers(cloudUsers);
      } else {
        // Se for a primeira vez criando o banco de Auth
        setDoc(docRef, { users: defaultUsers });
      }
    });

    return () => unsubscribe();
  }, []);

  // Mantém a sessão atual salva localmente
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
    }
  }, [currentUser]);

  // Função para salvar a lista inteira na nuvem sempre que houver alteração
  const syncUsersToCloud = async (newUsersList: AppUser[]) => {
    await setDoc(doc(db, 'auth', AUTH_DOC_ID), { users: newUsersList });
  };

  const login = (username: string, password: string) => {
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) return { success: false, message: 'Usuário ou senha incorretos.' };
    if (!user.approved) return { success: false, message: 'Seu cadastro ainda não foi aprovado por um administrador.' };
    
    setCurrentUser(user);
    return { success: true, message: '' };
  };

  const register = (username: string, password: string) => {
    if (username.length < 3) return { success: false, message: 'Usuário deve ter pelo menos 3 caracteres.' };
    if (password.length < 6) return { success: false, message: 'Senha deve ter pelo menos 6 caracteres.' };
    if (users.some(u => u.username === username)) return { success: false, message: 'Este usuário já existe.' };
    
    const newUser: AppUser = { username, password, approved: false, isAdmin: false };
    const updatedUsers = [...users, newUser];
    
    // Atualiza localmente e joga para a nuvem
    setUsers(updatedUsers);
    syncUsersToCloud(updatedUsers);
    
    return { success: true, message: 'Cadastro realizado! Aguarde aprovação do administrador.' };
  };

  const logout = () => {
    setCurrentUser(null);
  };

  const approveUser = (username: string) => {
    const updatedUsers = users.map(u => u.username === username ? { ...u, approved: true } : u);
    setUsers(updatedUsers);
    syncUsersToCloud(updatedUsers);
  };

  const rejectUser = (username: string) => {
    const updatedUsers = users.filter(u => u.username !== username);
    setUsers(updatedUsers);
    syncUsersToCloud(updatedUsers);
  };

  return (
    <AuthContext.Provider value={{ currentUser, users, login, register, logout, approveUser, rejectUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
