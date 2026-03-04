import React, { createContext, useContext, useReducer, useEffect, ReactNode, useRef } from 'react';
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot, runTransaction } from "firebase/firestore";

// 1. INICIALIZAÇÃO DO FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyD5lSgqKvXFZBK8-PalruztaoZliXxT8GE",
  authDomain: "eleicao-ipb.firebaseapp.com",
  projectId: "eleicao-ipb",
  storageBucket: "eleicao-ipb.firebasestorage.app",
  messagingSenderId: "1072551138226",
  appId: "1:1072551138226:web:24b2aa1109e5bdb0c10aab"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const ELECTION_DOC_ID = 'current'; // Nome do documento no banco de dados

// 2. INTERFACES
export type CandidateRole = 'presbitero' | 'presbitero_vencimento' | 'diacono' | 'diacono_vencimento' | 'membro';

export interface Candidate {
  id: string;
  name: string;
  photo: string;
  birthDate: string;
  currentRole: CandidateRole;
}

export type ScrutinyType = 'presbitero' | 'diacono';
export type ScrutinyStatus = 'pending' | 'open' | 'closed';

export interface Scrutiny {
  id: string;
  type: ScrutinyType;
  round: number;
  status: ScrutinyStatus;
  votes: Record<string, number>;
  totalVotes: number;
  startedAt?: number;
  participatingCandidateIds: string[];
  resultsApproved: boolean;
  electedIds: string[];
}

export interface ElectionState {
  title: string;
  date: string;
  voterGoal: number;
  presbyterSlots: number;
  deaconSlots: number;
  candidates: Candidate[];
  scrutinies: Scrutiny[];
  currentScrutinyId: string | null;
  electedPresbyters: string[];
  electedDeacons: string[];
  alerts: string[];
}

const initialState: ElectionState = {
  title: '',
  date: '',
  voterGoal: 0,
  presbyterSlots: 0,
  deaconSlots: 0,
  candidates: [],
  scrutinies: [],
  currentScrutinyId: null,
  electedPresbyters: [],
  electedDeacons: [],
  alerts: [],
};

type Action =
  | { type: 'SET_ELECTION'; payload: Partial<ElectionState> }
  | { type: 'ADD_CANDIDATE'; payload: Candidate }
  | { type: 'REMOVE_CANDIDATE'; payload: string }
  | { type: 'UPDATE_CANDIDATE'; payload: Candidate }
  | { type: 'START_SCRUTINY'; payload: { type: ScrutinyType; round: number; participatingCandidateIds: string[] } }
  | { type: 'CAST_VOTE'; payload: { scrutinyId: string; candidateIds: string[] } }
  | { type: 'CLOSE_SCRUTINY'; payload: string }
  | { type: 'APPROVE_RESULTS'; payload: string }
  | { type: 'ADD_ALERT'; payload: string }
  | { type: 'CLEAR_ALERTS' }
  | { type: 'SET_ELECTED'; payload: { type: ScrutinyType; candidateIds: string[] } }
  | { type: 'CLEAR_CANDIDATES' }
  | { type: 'RESET' }
  | { type: 'SYNC_FROM_FIREBASE'; payload: ElectionState }; // Nova ação para sincronização

// 3. LÓGICA DE APURAÇÃO (Mantida intacta)
export function resolveResults(
  scrutiny: Scrutiny,
  candidates: Candidate[],
  slots: number,
  alreadyElected: string[] = []
): { elected: string[]; tied: boolean } {
  const remainingSlots = slots - alreadyElected.length;
  if (remainingSlots <= 0) return { elected: [], tied: false };

  const majorityThreshold = Math.floor(scrutiny.totalVotes / 2) + 1;
  const isThirdOrLater = scrutiny.round >= 3;

  const entries = Object.entries(scrutiny.votes)
    .filter(([id]) => scrutiny.participatingCandidateIds.includes(id))
    .map(([id, count]) => ({
      id,
      count,
      candidate: candidates.find(c => c.id === id)!,
    }))
    .filter(e => e.candidate)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      const dateA = new Date(a.candidate.birthDate).getTime();
      const dateB = new Date(b.candidate.birthDate).getTime();
      return dateA - dateB; 
    });

  let elected: string[];
  
  if (isThirdOrLater) {
    elected = entries.slice(0, remainingSlots).map(e => e.id);
  } else {
    elected = entries
      .filter(e => e.count >= majorityThreshold)
      .slice(0, remainingSlots)
      .map(e => e.id);
  }

  return { elected, tied: false };
}

// 4. REDUTOR
function reducer(state: ElectionState, action: Action): ElectionState {
  switch (action.type) {
    case 'SYNC_FROM_FIREBASE':
      return action.payload; // Sobrescreve o estado local com os dados da nuvem

    case 'SET_ELECTION':
      return { ...state, ...action.payload };

    case 'ADD_CANDIDATE':
      return { ...state, candidates: [...state.candidates, action.payload] };

    case 'REMOVE_CANDIDATE':
      return { ...state, candidates: state.candidates.filter(c => c.id !== action.payload) };

    case 'UPDATE_CANDIDATE':
      return {
        ...state,
        candidates: state.candidates.map(c =>
          c.id === action.payload.id ? action.payload : c
        ),
      };

    case 'START_SCRUTINY': {
      const newScrutiny: Scrutiny = {
        id: `${action.payload.type}-${action.payload.round}`,
        type: action.payload.type,
        round: action.payload.round,
        status: 'open',
        votes: {},
        totalVotes: 0,
        startedAt: Date.now(),
        participatingCandidateIds: action.payload.participatingCandidateIds,
        resultsApproved: false,
        electedIds: [],
      };
      action.payload.participatingCandidateIds.forEach(id => {
        newScrutiny.votes[id] = 0;
      });
      return {
        ...state,
        scrutinies: [...state.scrutinies, newScrutiny],
        currentScrutinyId: newScrutiny.id,
      };
    }

    case 'CAST_VOTE': {
      const scrutinies = state.scrutinies.map(s => {
        if (s.id !== action.payload.scrutinyId) return s;
        const newVotes = { ...s.votes };
        action.payload.candidateIds.forEach(id => {
          newVotes[id] = (newVotes[id] || 0) + 1;
        });
        const newTotal = s.totalVotes + 1;
        const shouldClose = state.voterGoal > 0 && newTotal >= state.voterGoal;
        return { ...s, votes: newVotes, totalVotes: newTotal, status: shouldClose ? 'closed' as const : s.status };
      });

      const closedScrutiny = scrutinies.find(s => s.id === action.payload.scrutinyId && s.status === 'closed');
      if (closedScrutiny && closedScrutiny.status === 'closed') {
        const alreadyElected = closedScrutiny.type === 'presbitero' ? state.electedPresbyters : state.electedDeacons;
        const slots = closedScrutiny.type === 'presbitero' ? state.presbyterSlots : state.deaconSlots;
        const { elected } = resolveResults(closedScrutiny, state.candidates, slots, alreadyElected);
        
        const alerts: string[] = [];
        if (closedScrutiny.type === 'presbitero') {
          elected.forEach(id => {
            const candidate = state.candidates.find(c => c.id === id);
            if (candidate && (candidate.currentRole === 'diacono' || candidate.currentRole === 'diacono_vencimento')) {
              alerts.push(
                `⚠️ ${candidate.name} é atualmente ${candidate.currentRole === 'diacono' ? 'Diácono' : 'Diácono em Vencimento'} e foi eleito Presbítero. Ajuste o número de vagas ou candidatos para a votação de Diáconos.`
              );
            }
          });
        }

        const updatedScrutinies = scrutinies.map(s =>
          s.id === closedScrutiny.id ? { ...s, electedIds: elected } : s
        );

        return {
          ...state,
          scrutinies: updatedScrutinies,
          currentScrutinyId: null,
          alerts: [...state.alerts, ...alerts],
          electedPresbyters: closedScrutiny.type === 'presbitero' ? [...alreadyElected, ...elected] : state.electedPresbyters,
          electedDeacons: closedScrutiny.type === 'diacono' ? [...alreadyElected, ...elected] : state.electedDeacons,
        };
      }

      return { ...state, scrutinies };
    }

    case 'CLOSE_SCRUTINY': {
      const alerts: string[] = [];
      const scrutinies = state.scrutinies.map(s => {
        if (s.id !== action.payload) return s;
        return { ...s, status: 'closed' as ScrutinyStatus };
      });

      const closedScrutiny = scrutinies.find(s => s.id === action.payload)!;
      const alreadyElected = closedScrutiny.type === 'presbitero' ? state.electedPresbyters : state.electedDeacons;
      const slots = closedScrutiny.type === 'presbitero' ? state.presbyterSlots : state.deaconSlots;
      const { elected } = resolveResults(closedScrutiny, state.candidates, slots, alreadyElected);

      if (closedScrutiny.type === 'presbitero') {
        elected.forEach(id => {
          const candidate = state.candidates.find(c => c.id === id);
          if (candidate && (candidate.currentRole === 'diacono' || candidate.currentRole === 'diacono_vencimento')) {
            alerts.push(
              `⚠️ ${candidate.name} é atualmente ${candidate.currentRole === 'diacono' ? 'Diácono' : 'Diácono em Vencimento'} e foi eleito Presbítero. Ajuste o número de vagas ou candidatos para a votação de Diáconos.`
            );
          }
        });
      }

      const updatedScrutinies = scrutinies.map(s =>
        s.id === action.payload ? { ...s, electedIds: elected } : s
      );

      return {
        ...state,
        scrutinies: updatedScrutinies,
        currentScrutinyId: null,
        alerts: [...state.alerts, ...alerts],
        electedPresbyters: closedScrutiny.type === 'presbitero' ? [...alreadyElected, ...elected] : state.electedPresbyters,
        electedDeacons: closedScrutiny.type === 'diacono' ? [...alreadyElected, ...elected] : state.electedDeacons,
      };
    }

    case 'APPROVE_RESULTS': {
      return {
        ...state,
        scrutinies: state.scrutinies.map(s =>
          s.id === action.payload ? { ...s, resultsApproved: true } : s
        ),
      };
    }

    case 'ADD_ALERT':
      return { ...state, alerts: [...state.alerts, action.payload] };

    case 'CLEAR_ALERTS':
      return { ...state, alerts: [] };

    case 'SET_ELECTED':
      if (action.payload.type === 'presbitero') {
        return { ...state, electedPresbyters: action.payload.candidateIds };
      }
      return { ...state, electedDeacons: action.payload.candidateIds };

    case 'CLEAR_CANDIDATES':
      return { ...state, candidates: [] };

    case 'RESET':
      return { ...initialState, candidates: state.candidates };

    default:
      return state;
  }
}

const ElectionContext = createContext<{
  state: ElectionState;
  dispatch: React.Dispatch<Action>;
  resolveScrutinyResults: (scrutiny: Scrutiny, slots: number, alreadyElected?: string[]) => { elected: string[]; tied: boolean };
} | null>(null);

export function ElectionProvider({ children }: { children: ReactNode }) {
  // Inicializamos o estado sem localStorage
  const [state, defaultDispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);

  // Mantém uma referência atualizada do estado para uso seguro nas funções
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Sincronização em Tempo Real com o Firebase
  useEffect(() => {
    const docRef = doc(db, 'elections', ELECTION_DOC_ID);
    
    // Fica "ouvindo" o banco de dados. Qualquer mudança cai aqui!
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const remoteState = snapshot.data() as ElectionState;
        defaultDispatch({ type: 'SYNC_FROM_FIREBASE', payload: remoteState });
      } else {
        // Se for a primeira vez rodando, cria o documento no banco
        setDoc(docRef, initialState);
      }
    });

    return () => unsubscribe();
  }, []);

  // Novo Dispatch que intercepta as ações e envia para a nuvem
  const dispatch = async (action: Action) => {
    const docRef = doc(db, 'elections', ELECTION_DOC_ID);

    // PROTEÇÃO CONTRA CONCORRÊNCIA DE VOTOS (Evita choque entre urnas simultâneas)
    if (action.type === 'CAST_VOTE') {
      try {
        await runTransaction(db, async (transaction) => {
          const sfDoc = await transaction.get(docRef);
          if (!sfDoc.exists()) return;
          
          const remoteState = sfDoc.data() as ElectionState;
          // Calcula o voto baseando-se no estado MAIS RECENTE do servidor, e não do tablet
          const nextState = reducer(remoteState, action);
          transaction.set(docRef, nextState);
        });
      } catch (error) {
        console.error("Erro ao registrar voto na transação:", error);
      }
      return;
    }

    // Para todas as outras ações (Adicionar candidato, criar Escrutínio, etc)
    const nextState = reducer(stateRef.current, action);
    try {
      await setDoc(docRef, nextState);
    } catch (error) {
      console.error("Erro ao sincronizar sistema:", error);
    }
  };

  const resolveScrutinyResults = (scrutiny: Scrutiny, slots: number, alreadyElected: string[] = []) =>
    resolveResults(scrutiny, state.candidates, slots, alreadyElected);

  return (
    <ElectionContext.Provider value={{ state, dispatch, resolveScrutinyResults }}>
      {children}
    </ElectionContext.Provider>
  );
}

export function useElection() {
  const ctx = useContext(ElectionContext);
  if (!ctx) throw new Error('useElection must be used within ElectionProvider');
  return ctx;
}
