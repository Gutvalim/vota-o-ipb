import { useEffect, useState } from 'react';
import { useElection } from '@/contexts/ElectionContext';
import { Vote, Users, Clock, Trophy } from 'lucide-react';

export default function DataShow() {
  const { state, resolveScrutinyResults } = useElection();
  const [elapsed, setElapsed] = useState(0);

  const currentScrutiny = state.scrutinies.find(s => s.id === state.currentScrutinyId);
  const isOpen = currentScrutiny?.status === 'open';

  // Find latest APPROVED closed scrutiny for results
  const approvedScrutinies = state.scrutinies.filter(s => s.status === 'closed' && s.resultsApproved);
  const latestApproved = approvedScrutinies[approvedScrutinies.length - 1];

  // Timer
  useEffect(() => {
    if (!isOpen || !currentScrutiny?.startedAt) {
      setElapsed(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - currentScrutiny.startedAt!) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, currentScrutiny?.startedAt]);

  // Refresh state from localStorage periodically
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const saved = localStorage.getItem('ipb-election');
        if (saved) {
          window.dispatchEvent(new Event('storage'));
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const progress = state.voterGoal > 0 && currentScrutiny
    ? Math.min((currentScrutiny.totalVotes / state.voterGoal) * 100, 100)
    : 0;

  // Check if there's a closed but not yet approved scrutiny
  const pendingApproval = state.scrutinies.find(s => s.status === 'closed' && !s.resultsApproved);

  // WAITING STATE
  if (!isOpen && !latestApproved && !pendingApproval) {
    return (
      <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-8">
        <Vote className="w-20 h-20 text-gold mb-8" />
        <h1 className="text-5xl font-display font-bold text-primary-foreground mb-4 text-center">
          {state.title || 'Sistema de Votação Eletrônica'}
        </h1>
        <p className="text-2xl text-primary-foreground/50 font-display">
          Igreja Presbiteriana do Brasil
        </p>
        {state.date && (
          <p className="text-xl text-primary-foreground/30 mt-4">
            {new Date(state.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        )}
        <p className="text-primary-foreground/20 mt-12 text-lg">Aguardando início da votação...</p>
      </div>
    );
  }

  // VOTING IN PROGRESS
  if (isOpen && currentScrutiny) {
    return (
      <div className="min-h-screen bg-primary flex flex-col p-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-display font-bold text-primary-foreground mb-2">
            {state.title || 'Votação em Andamento'}
          </h1>
          <p className="text-2xl text-gold font-display">
            {currentScrutiny.type === 'presbitero' ? 'Eleição de Presbíteros' : 'Eleição de Diáconos'} — {currentScrutiny.round}º Escrutínio
          </p>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="grid md:grid-cols-2 gap-16 w-full max-w-4xl">
            <div className="text-center">
              <Clock className="w-12 h-12 text-gold mx-auto mb-4" />
              <p className="text-primary-foreground/50 text-lg mb-2">Tempo Decorrido</p>
              <p className="text-8xl font-mono font-bold text-primary-foreground tracking-wider">
                {formatTime(elapsed)}
              </p>
            </div>
            <div className="text-center">
              <Users className="w-12 h-12 text-gold mx-auto mb-4" />
              <p className="text-primary-foreground/50 text-lg mb-2">Votos Computados</p>
              <p className="text-8xl font-mono font-bold text-primary-foreground">
                {currentScrutiny.totalVotes}
              </p>
              <p className="text-2xl text-primary-foreground/40 mt-2">
                de {state.voterGoal} eleitores
              </p>
              <div className="mt-6 w-full bg-primary-foreground/10 rounded-full h-4 overflow-hidden">
                <div
                  className="h-full bg-gold rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-primary-foreground/30 text-sm mt-2">{Math.round(progress)}%</p>
            </div>
          </div>
        </div>

        <p className="text-center text-primary-foreground/20 text-sm">
          Os resultados serão exibidos após o encerramento e aprovação pelo administrador
        </p>
      </div>
    );
  }

  // PENDING APPROVAL (closed but not approved)
  if (pendingApproval && !latestApproved) {
    return (
      <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-8">
        <Vote className="w-20 h-20 text-gold mb-8" />
        <h1 className="text-4xl font-display font-bold text-primary-foreground mb-4 text-center">
          Votação Encerrada
        </h1>
        <p className="text-xl text-primary-foreground/50 mt-4">
          Aguardando aprovação do resultado pelo administrador...
        </p>
      </div>
    );
  }

  // RESULTS (only approved)
  if (latestApproved) {
    const alreadyElectedBefore = latestApproved.type === 'presbitero'
      ? state.electedPresbyters.filter(id => !latestApproved.electedIds.includes(id))
      : state.electedDeacons.filter(id => !latestApproved.electedIds.includes(id));
    const slots = latestApproved.type === 'presbitero' ? state.presbyterSlots : state.deaconSlots;

    const sortedEntries = Object.entries(latestApproved.votes)
      .filter(([id]) => latestApproved.participatingCandidateIds.includes(id))
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        const ca = state.candidates.find(c => c.id === a[0]);
        const cb = state.candidates.find(c => c.id === b[0]);
        if (!ca || !cb) return 0;
        return new Date(ca.birthDate).getTime() - new Date(cb.birthDate).getTime();
      });

    return (
      <div className="min-h-screen bg-primary flex flex-col p-8">
        <div className="text-center mb-8">
          <Trophy className="w-12 h-12 text-gold mx-auto mb-4" />
          <h1 className="text-4xl font-display font-bold text-primary-foreground mb-2">
            Resultado — {latestApproved.type === 'presbitero' ? 'Presbíteros' : 'Diáconos'}
          </h1>
          <p className="text-xl text-primary-foreground/50">
            {latestApproved.round}º Escrutínio — {latestApproved.totalVotes} votos computados
          </p>
        </div>

        <div className="flex-1 flex items-start justify-center overflow-auto">
          <div className="w-full max-w-3xl space-y-3">
            {sortedEntries.map(([candidateId, votes], index) => {
              const candidate = state.candidates.find(c => c.id === candidateId);
              const isElected = latestApproved.electedIds.includes(candidateId);
              const maxVotes = sortedEntries[0]?.[1] || 1;
              const barWidth = (votes / maxVotes) * 100;

              return (
                <div
                  key={candidateId}
                  className={`
                    flex items-center gap-4 p-4 rounded-xl transition-all
                    ${isElected ? 'bg-gold/15 border border-gold/30' : 'bg-primary-foreground/5'}
                  `}
                >
                  <span className={`text-2xl font-bold w-8 text-center ${isElected ? 'text-gold' : 'text-primary-foreground/30'}`}>
                    {index + 1}
                  </span>
                  <div className="w-14 h-14 rounded-full bg-primary-foreground/10 overflow-hidden shrink-0">
                    {candidate?.photo ? (
                      <img src={candidate.photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Users className="w-6 h-6 text-primary-foreground/20" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-display font-bold text-lg ${isElected ? 'text-gold' : 'text-primary-foreground'}`}>
                        {candidate?.name || 'Desconhecido'}
                      </span>
                      {isElected && (
                        <span className="bg-gold text-accent-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                          ELEITO
                        </span>
                      )}
                    </div>
                    <div className="w-full bg-primary-foreground/5 rounded-full h-2.5">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${isElected ? 'bg-gold' : 'bg-primary-foreground/20'}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                  <span className={`text-3xl font-mono font-bold ${isElected ? 'text-gold' : 'text-primary-foreground/50'}`}>
                    {votes}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-center text-primary-foreground/20 text-sm mt-4">
          Em caso de empate, prevalece o candidato mais velho conforme praxe presbiteriana
        </p>
      </div>
    );
  }

  return null;
}
