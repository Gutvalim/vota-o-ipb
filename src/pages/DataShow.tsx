import { useEffect, useState } from 'react';
import { useElection } from '@/contexts/ElectionContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Vote, Users, Clock, ArrowLeft } from 'lucide-react';
import logoIpnb from '@/assets/logo_ipnb.png';

export default function DataShow() {
  const { state } = useElection();
  const navigate = useNavigate();
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

  const BackButton = () => (
    <Button
      variant="ghost"
      onClick={() => navigate('/')}
      className="absolute top-4 left-4 text-primary-foreground/30 hover:text-primary-foreground hover:bg-primary-foreground/10 z-50 transition-colors"
    >
      <ArrowLeft className="w-6 h-6 mr-2" /> Voltar
    </Button>
  );

  // TELA 1: AGUARDANDO
  if (!isOpen && !latestApproved && !pendingApproval) {
    return (
      <div className="min-h-screen bg-primary relative flex flex-col items-center justify-center p-8 overflow-hidden">
        <BackButton />
        <img src={logoIpnb} alt="Logo IPNB" className="w-32 h-32 object-contain rounded-full mb-10" />
        <h1 className="text-6xl md:text-8xl font-display font-bold text-primary-foreground mb-6 text-center leading-tight">
          {state.title || 'Sistema de Votação'}
        </h1>
        {/* NOVO: Adicionado text-center aqui */}
        <p className="text-3xl md:text-4xl text-primary-foreground/50 font-display text-center">
          Igreja Presbiteriana do Brasil
        </p>
        {state.date && (
          <p className="text-3xl text-primary-foreground/30 mt-6 font-mono text-center">
            {new Date(state.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </p>
        )}
        <p className="text-primary-foreground/30 mt-16 text-3xl animate-pulse text-center">Aguardando início da votação...</p>
      </div>
    );
  }

  // TELA 2: VOTAÇÃO EM ANDAMENTO
  if (isOpen && currentScrutiny) {
    return (
      <div className="min-h-screen bg-primary relative flex flex-col p-8 overflow-hidden">
        <BackButton />
        <div className="text-center mb-12 shrink-0">
          <h1 className="text-5xl md:text-7xl font-display font-bold text-primary-foreground mb-4">
            {state.title || 'Votação em Andamento'}
          </h1>
          <p className="text-4xl text-gold font-display font-bold">
            {currentScrutiny.type === 'presbitero' ? 'Eleição de Presbíteros' : 'Eleição de Diáconos'} — {currentScrutiny.round}º Escrutínio
          </p>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="grid md:grid-cols-2 gap-20 w-full max-w-6xl">
            <div className="text-center bg-primary-foreground/5 p-12 rounded-3xl border border-primary-foreground/10">
              <Clock className="w-20 h-20 text-gold mx-auto mb-6" />
              <p className="text-primary-foreground/50 text-3xl mb-4 uppercase tracking-widest font-bold">Tempo</p>
              <p className="text-[10rem] leading-none font-mono font-bold text-primary-foreground tracking-tight">
                {formatTime(elapsed)}
              </p>
            </div>
            <div className="text-center bg-primary-foreground/5 p-12 rounded-3xl border border-primary-foreground/10">
              <Users className="w-20 h-20 text-gold mx-auto mb-6" />
              <p className="text-primary-foreground/50 text-3xl mb-4 uppercase tracking-widest font-bold">Votos</p>
              <p className="text-[10rem] leading-none font-mono font-bold text-primary-foreground">
                {currentScrutiny.totalVotes}
              </p>
              <p className="text-3xl text-primary-foreground/40 mt-4 font-bold">
                de {state.voterGoal} eleitores
              </p>
              <div className="mt-8 w-full bg-primary-foreground/10 rounded-full h-6 overflow-hidden">
                <div
                  className="h-full bg-gold rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // TELA 3: AGUARDANDO APURAÇÃO
  if (pendingApproval) {
    return (
      <div className="min-h-screen bg-primary relative flex flex-col items-center justify-center p-8 overflow-hidden">
        <BackButton />
        <img src={logoIpnb} alt="Logo IPNB" className="w-40 h-40 object-contain rounded-full mb-12 animate-pulse" />
        <h1 className="text-7xl font-display font-bold text-primary-foreground mb-6 text-center">
          Votação Encerrada
        </h1>
        <p className="text-4xl text-primary-foreground/50 mt-4 text-center">
          Aguardando apuração do resultado...
        </p>
      </div>
    );
  }

  // TELA 4: RESULTADOS
  if (latestApproved) {
    const sortedEntries = Object.entries(latestApproved.votes)
      .filter(([id]) => latestApproved.participatingCandidateIds.includes(id))
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        const ca = state.candidates.find(c => c.id === a[0]);
        const cb = state.candidates.find(c => c.id === b[0]);
        if (!ca || !cb) return 0;
        return new Date(ca.birthDate).getTime() - new Date(cb.birthDate).getTime();
      });

    const hasBlankVotes = (latestApproved.blankVotes || 0) > 0;
    const totalItems = sortedEntries.length + (hasBlankVotes ? 1 : 0);
    
    const useTwoColumns = totalItems > 6;

    return (
      <div className="min-h-screen bg-primary relative flex flex-col p-6 md:p-8 overflow-hidden">
        <BackButton />
        
        <div className="text-center mb-6 shrink-0 mt-4">
          <div className="flex items-center justify-center gap-6 mb-2">
            <Trophy className="w-16 h-16 text-gold" />
            <h1 className="text-5xl md:text-7xl font-display font-bold text-primary-foreground">
              Resultado — {latestApproved.type === 'presbitero' ? 'Presbíteros' : 'Diáconos'}
            </h1>
          </div>
          <p className="text-3xl text-primary-foreground/50 font-bold">
            {latestApproved.round}º Escrutínio — {latestApproved.totalVotes} votos computados
          </p>
        </div>

        <div className="flex-1 flex items-center justify-center w-full">
          <div className={`w-full max-w-[95%] grid gap-4 md:gap-5 ${useTwoColumns ? 'lg:grid-cols-2' : 'max-w-4xl grid-cols-1'}`}>
            
            {sortedEntries.map(([candidateId, votes], index) => {
              const candidate = state.candidates.find(c => c.id === candidateId);
              const isElected = latestApproved.electedIds.includes(candidateId);
              const maxVotes = sortedEntries[0]?.[1] || 1;
              const barWidth = (votes / maxVotes) * 100;

              return (
                <div
                  key={candidateId}
                  className={`
                    flex items-center gap-4 py-3 px-5 rounded-2xl transition-all
                    ${isElected ? 'bg-gold/15 border-2 border-gold/40 shadow-[0_0_20px_rgba(255,215,0,0.1)]' : 'bg-primary-foreground/5 border-2 border-transparent'}
                  `}
                >
                  <span className={`text-3xl md:text-4xl font-bold w-12 text-center ${isElected ? 'text-gold' : 'text-primary-foreground/30'}`}>
                    {index + 1}º
                  </span>
                  
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-primary-foreground/10 overflow-hidden shrink-0 border-2 border-primary-foreground/10">
                    {candidate?.photo ? (
                      <img src={candidate.photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Users className="w-8 h-8 text-primary-foreground/20" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-4 mb-2">
                      <span className={`font-display font-bold text-3xl md:text-4xl truncate ${isElected ? 'text-gold' : 'text-primary-foreground'}`}>
                        {candidate?.name || 'Desconhecido'}
                      </span>
                      {isElected && (
                        <span className="bg-gold text-accent-foreground text-lg font-bold px-3 py-1 rounded-full shrink-0">
                          ELEITO
                        </span>
                      )}
                    </div>
                    <div className="w-full bg-primary-foreground/10 rounded-full h-3">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${isElected ? 'bg-gold' : 'bg-primary-foreground/30'}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                  
                  <span className={`text-5xl md:text-6xl font-mono font-bold tracking-tighter ${isElected ? 'text-gold' : 'text-primary-foreground/60'}`}>
                    {votes}
                  </span>
                </div>
              );
            })}

            {hasBlankVotes && (
              <div className="flex items-center gap-4 py-3 px-5 rounded-2xl transition-all bg-secondary/20 border-2 border-secondary/30">
                <span className="text-3xl md:text-4xl font-bold w-12 text-center text-primary-foreground/30">-</span>
                
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-secondary/30 flex items-center justify-center shrink-0 border-2 border-secondary/40">
                  <Vote className="w-8 h-8 text-primary-foreground/50" />
                </div>
                
                <div className="flex-1 min-w-0 pr-4">
                  <span className="font-display font-bold text-3xl md:text-4xl text-primary-foreground/70 uppercase tracking-wide">
                    Votos em Branco
                  </span>
                </div>
                
                <span className="text-5xl md:text-6xl font-mono font-bold tracking-tighter text-primary-foreground/50">
                  {latestApproved.blankVotes}
                </span>
              </div>
            )}
            
          </div>
        </div>

        <p className="text-center text-primary-foreground/30 text-xl font-bold mt-6 shrink-0">
          Em caso de empate, prevalece o candidato mais velho conforme Manual Presbiteriano
        </p>
      </div>
    );
  }

  return null;
}
