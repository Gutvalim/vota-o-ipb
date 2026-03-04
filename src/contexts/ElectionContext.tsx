import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';

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
  votes: Record<string, number>; // candidateId -> count
  totalVotes: number;
  startedAt?: number;
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
  | { type: 'START_SCRUTINY'; payload: { type: ScrutinyType; round: number } }
  | { type: 'CAST_VOTE'; payload: { scrutinyId: string; candidateIds: string[] } }
  | { type: 'CLOSE_SCRUTINY'; payload: string }
  | { type: 'ADD_ALERT'; payload: string }
  | { type: 'CLEAR_ALERTS' }
  | { type: 'SET_ELECTED'; payload: { type: ScrutinyType; candidateIds: string[] } }
  | { type: 'RESET' };

function resolveResults(
  scrutiny: Scrutiny,
  candidates: Candidate[],
  slots: number
): { elected: string[]; tied: boolean } {
  const entries = Object.entries(scrutiny.votes)
    .map(([id, count]) => ({
      id,
      count,
      candidate: candidates.find(c => c.id === id)!,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      // Tiebreaker: older candidate wins
      const dateA = new Date(a.candidate.birthDate).getTime();
      const dateB = new Date(b.candidate.birthDate).getTime();
      return dateA - dateB; // older = smaller timestamp = first
    });

  const elected = entries.slice(0, slots).map(e => e.id);
  const threshold = Math.floor(scrutiny.totalVotes / 2) + 1;
  const allHaveMajority = elected.every(id => (scrutiny.votes[id] || 0) >= threshold);
  
  return { elected, tied: !allHaveMajority };
}

function reducer(state: ElectionState, action: Action): ElectionState {
  switch (action.type) {
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
      };
      // Initialize votes for relevant candidates
      const relevantCandidates = state.candidates.filter(c => {
        if (action.payload.type === 'presbitero') return true; // all can run for presbyter
        return true; // all can run for deacon too
      });
      relevantCandidates.forEach(c => {
        newScrutiny.votes[c.id] = 0;
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
        return { ...s, votes: newVotes, totalVotes: s.totalVotes + 1 };
      });
      return { ...state, scrutinies };
    }

    case 'CLOSE_SCRUTINY': {
      const alerts: string[] = [];
      const scrutinies = state.scrutinies.map(s => {
        if (s.id !== action.payload) return s;
        return { ...s, status: 'closed' as ScrutinyStatus };
      });

      const closedScrutiny = scrutinies.find(s => s.id === action.payload)!;
      const slots = closedScrutiny.type === 'presbitero' ? state.presbyterSlots : state.deaconSlots;
      const { elected } = resolveResults(closedScrutiny, state.candidates, slots);

      // Check vacancy logic
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

      const newState = {
        ...state,
        scrutinies,
        currentScrutinyId: null,
        alerts: [...state.alerts, ...alerts],
      };

      if (closedScrutiny.type === 'presbitero') {
        newState.electedPresbyters = elected;
      } else {
        newState.electedDeacons = elected;
      }

      return newState;
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

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

const ElectionContext = createContext<{
  state: ElectionState;
  dispatch: React.Dispatch<Action>;
  resolveResults: (scrutiny: Scrutiny, slots: number) => { elected: string[]; tied: boolean };
} | null>(null);

export function ElectionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState, () => {
    try {
      const saved = localStorage.getItem('ipb-election');
      return saved ? JSON.parse(saved) : initialState;
    } catch {
      return initialState;
    }
  });

  useEffect(() => {
    localStorage.setItem('ipb-election', JSON.stringify(state));
  }, [state]);

  const resolve = (scrutiny: Scrutiny, slots: number) =>
    resolveResults(scrutiny, state.candidates, slots);

  return (
    <ElectionContext.Provider value={{ state, dispatch, resolveResults: resolve }}>
      {children}
    </ElectionContext.Provider>
  );
}

export function useElection() {
  const ctx = useContext(ElectionContext);
  if (!ctx) throw new Error('useElection must be used within ElectionProvider');
  return ctx;
}
