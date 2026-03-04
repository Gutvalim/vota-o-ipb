import { useState } from 'react';
import { useElection } from '@/contexts/ElectionContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2, Vote, Users } from 'lucide-react';
import { toast } from 'sonner';

export default function Urna() {
  const { state, dispatch } = useElection();
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const currentScrutiny = state.scrutinies.find(s => s.id === state.currentScrutinyId);
  const isOpen = currentScrutiny?.status === 'open';

  // LÓGICA CORRIGIDA: Calcula exatamente as vagas RESTANTES para limitar os cliques
  const alreadyElected = currentScrutiny?.type === 'presbitero' ? state.electedPresbyters : state.electedDeacons;
  const totalSlots = currentScrutiny?.type === 'presbitero' ? state.presbyterSlots : state.deaconSlots;
  const effectiveMax = currentScrutiny ? (totalSlots - (alreadyElected?.length || 0)) : 0;

  // Mostra apenas os candidatos participantes da rodada atual
  const participatingCandidates = isOpen && currentScrutiny
    ? state.candidates.filter(c => currentScrutiny.participatingCandidateIds.includes(c.id))
    : [];

  // Checa se a meta de votos foi atingida (fechamento automático)
  const votingClosed = currentScrutiny && currentScrutiny.status === 'closed';

  const toggleCandidate = (id: string) => {
    if (hasVoted) return;
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      // Aqui aplicamos o limite dinâmico das vagas que sobraram
      if (prev.length >= effectiveMax) {
        toast.error(`Selecione no máximo ${effectiveMax} candidato(s)`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleConfirm = () => {
    if (!currentScrutiny) return;
    dispatch({ type: 'CAST_VOTE', payload: { scrutinyId: currentScrutiny.id, candidateIds: selectedIds } });
    setHasVoted(true);
    setShowConfirm(false);
  };

  const handleNewVote = () => {
    setSelectedIds([]);
    setHasVoted(false);
    setShowConfirm(false);
  };

  if (!isOpen || votingClosed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-primary p-8">
        <Vote className="w-16 h-16 text-gold mb-6" />
        <h1 className="text-3xl font-display font-bold text-primary-foreground mb-4 text-center">
          {state.title || 'Sistema de Votação'}
        </h1>
        <p className="text-primary-foreground/60 text-lg mb-8 text-center">
          {votingClosed ? 'A votação foi encerrada. Aguarde o resultado.' : 'Nenhuma votação em andamento no momento.'}
        </p>
        <Button variant="ghost" onClick={() => navigate('/')} className="text-primary-foreground/40 hover:text-primary-foreground hover:bg-primary-foreground/10">
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  if (hasVoted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-primary p-8">
        <div className="vote-confirmed text-center">
          <CheckCircle2 className="w-24 h-24 text-success mx-auto mb-6" />
          <h1 className="text-4xl font-display font-bold text-primary-foreground mb-4">
            Voto Confirmado!
          </h1>
          <p className="text-primary-foreground/60 text-lg mb-8">
            Seu voto foi computado com sucesso.
          </p>
          <Button onClick={handleNewVote} className="bg-gold text-accent-foreground hover:bg-gold-light text-lg px-8 py-6">
            Próximo Eleitor
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary flex flex-col">
      {/* Header */}
      <header className="p-4 border-b border-primary-foreground/10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-display font-bold text-primary-foreground">
              {currentScrutiny.type === 'presbitero' ? 'Eleição de Presbíteros' : 'Eleição de Diáconos'}
            </h1>
            <p className="text-sm text-primary-foreground/50">
              {currentScrutiny.round}º Escrutínio — Selecione até {effectiveMax} candidato(s)
            </p>
          </div>
          <VoteBadge count={selectedIds.length} max={effectiveMax} />
        </div>
      </header>

      {/* Candidates Grid */}
      <main className="flex-1 p-4 md:p-6 overflow-auto">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {participatingCandidates.map(c => {
            const isSelected = selectedIds.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleCandidate(c.id)}
                className={`
                  relative p-4 rounded-xl transition-all duration-200 text-center
                  ${isSelected
                    ? 'bg-gold/20 border-2 border-gold ring-2 ring-gold/30 scale-[1.02]'
                    : 'bg-primary-foreground/5 border-2 border-transparent hover:bg-primary-foreground/10'
                  }
                `}
              >
                <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-primary-foreground/10 overflow-hidden">
                  {c.photo ? (
                    <img src={c.photo} alt={c.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Users className="w-8 h-8 text-primary-foreground/30" />
                    </div>
                  )}
                </div>
                <p className="text-primary-foreground font-semibold text-sm leading-tight">{c.name}</p>
                {isSelected && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-gold flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-accent-foreground" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 border-t border-primary-foreground/10">
        <div className="max-w-4xl mx-auto flex justify-center">
          {showConfirm ? (
            <div className="text-center space-y-3">
              <p className="text-primary-foreground font-display font-bold text-lg">
                Confirmar voto em {selectedIds.length} candidato(s)?
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="ghost" onClick={() => setShowConfirm(false)} className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                  Corrigir
                </Button>
                <Button onClick={handleConfirm} className="bg-success text-success-foreground hover:bg-success/90 text-lg px-8 py-6 animate-pulse-ring">
                  CONFIRMAR
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => {
                if (selectedIds.length === 0) {
                  toast.error('Selecione pelo menos um candidato');
                  return;
                }
                setShowConfirm(true);
              }}
              className="bg-gold text-accent-foreground hover:bg-gold-light text-lg px-12 py-6"
            >
              <Vote className="w-5 h-5 mr-2" /> Votar ({selectedIds.length}/{effectiveMax})
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

function VoteBadge({ count, max }: { count: number; max: number }) {
  return (
    <div className="flex items-center gap-2 bg-primary-foreground/10 px-4 py-2 rounded-full">
      <span className="text-primary-foreground/60 text-sm">Selecionados:</span>
      <span className={`font-bold text-lg ${count === max ? 'text-gold' : 'text-primary-foreground'}`}>
        {count}/{max}
      </span>
    </div>
  );
}
