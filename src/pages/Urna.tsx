import { useState } from 'react';
import { useElection } from '@/contexts/ElectionContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2, Vote, Users } from 'lucide-react';
import { toast } from 'sonner';

const playConfirmSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    const audioCtx = new AudioContextClass();
    const now = audioCtx.currentTime;

    const playNote = (frequency: number, startTime: number, duration: number) => {
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'triangle';
      oscillator.frequency.value = frequency;

      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    playNote(523.25, now, 0.3);
    playNote(659.25, now + 0.15, 0.4);

  } catch (error) {
    console.error("Erro ao reproduzir o som de confirmação", error);
  }
};

export default function Urna() {
  const { state, dispatch } = useElection();
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const currentScrutiny = state.scrutinies.find(s => s.id === state.currentScrutinyId);
  const isOpen = currentScrutiny?.status === 'open';

  const alreadyElected = currentScrutiny?.type === 'presbitero' ? state.electedPresbyters : state.electedDeacons;
  const totalSlots = currentScrutiny?.type === 'presbitero' ? state.presbyterSlots : state.deaconSlots;
  const effectiveMax = currentScrutiny ? (totalSlots - (alreadyElected?.length || 0)) : 0;

  const participatingCandidates = isOpen && currentScrutiny
    ? state.candidates
        .filter(c => currentScrutiny.participatingCandidateIds.includes(c.id))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    : [];

  const votingClosed = currentScrutiny && currentScrutiny.status === 'closed';
  
  // Cálculo de votos em branco para exibir a mensagem correta na tela
  const blankCount = effectiveMax - selectedIds.length;

  const toggleCandidate = (id: string) => {
    if (hasVoted) return;
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= effectiveMax) {
        toast.error(`Selecione no máximo ${effectiveMax} candidato(s)`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleConfirm = () => {
    if (!currentScrutiny) return;
    
    playConfirmSound();

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
      <div className="h-screen flex flex-col items-center justify-center bg-primary p-8 overflow-hidden">
        <Vote className="w-24 h-24 text-gold mb-6" />
        <h1 className="text-4xl md:text-5xl font-display font-bold text-primary-foreground mb-4 text-center">
          {state.title || 'Sistema de Votação'}
        </h1>
        <p className="text-primary-foreground/60 text-2xl mb-8 text-center">
          {votingClosed ? 'A votação foi encerrada. Aguarde o resultado.' : 'Nenhuma votação em andamento no momento.'}
        </p>
        <Button variant="ghost" onClick={() => navigate('/')} className="text-primary-foreground/40 hover:text-primary-foreground hover:bg-primary-foreground/10 text-xl py-6">
          <ArrowLeft className="w-6 h-6 mr-2" /> Voltar ao Início
        </Button>
      </div>
    );
  }

  if (hasVoted) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-primary p-8 overflow-hidden">
        <div className="text-center">
          <CheckCircle2 className="w-32 h-32 text-success mx-auto mb-8" />
          <h1 className="text-5xl md:text-6xl font-display font-bold text-primary-foreground mb-6">
            Voto Confirmado!
          </h1>
          <p className="text-primary-foreground/60 text-2xl mb-12">
            Seu voto foi registrado com sucesso.
          </p>
          <Button onClick={handleNewVote} className="bg-gold text-accent-foreground hover:bg-gold-light text-2xl px-12 py-8">
            Liberar para o Próximo Eleitor
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-primary flex flex-col overflow-hidden">
      <header className="shrink-0 p-3 md:p-4 border-b border-primary-foreground/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-primary-foreground leading-none">
              {currentScrutiny.type === 'presbitero' ? 'Presbíteros' : 'Diáconos'}
            </h1>
            <p className="text-lg md:text-xl text-primary-foreground/60 mt-1">
              {currentScrutiny.round}º Turno — Escolha até {effectiveMax} nome(s)
            </p>
          </div>
          <div className="flex items-center gap-2 bg-primary-foreground/10 px-5 py-2 md:py-3 rounded-xl">
            <span className="text-primary-foreground/60 text-lg md:text-xl font-bold">Escolhidos:</span>
            <span className={`font-bold text-2xl md:text-3xl ${selectedIds.length === effectiveMax ? 'text-gold' : 'text-primary-foreground'}`}>
              {selectedIds.length}/{effectiveMax}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-2 md:p-4">
        <div className="w-full max-w-7xl grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4">
          {participatingCandidates.map(c => {
            const isSelected = selectedIds.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleCandidate(c.id)}
                className={`
                  relative p-3 md:p-4 rounded-xl transition-all duration-200 text-center flex flex-col items-center justify-center
                  ${isSelected
                    ? 'bg-gold/20 border-4 border-gold ring-4 ring-gold/30 scale-[1.02]'
                    : 'bg-primary-foreground/5 border-4 border-transparent hover:bg-primary-foreground/10'
                  }
                `}
              >
                <div className="w-16 h-16 md:w-24 md:h-24 mb-3 rounded-full bg-primary-foreground/10 overflow-hidden shrink-0 shadow-lg">
                  {c.photo ? (
                    <img src={c.photo} alt={c.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Users className="w-8 h-8 md:w-12 md:h-12 text-primary-foreground/30" />
                    </div>
                  )}
                </div>
                <p className="text-primary-foreground font-bold text-xl md:text-2xl leading-tight line-clamp-2">
                  {c.name}
                </p>
                {isSelected && (
                  <div className="absolute top-2 right-2 md:top-3 md:right-3 w-8 h-8 md:w-10 md:h-10 rounded-full bg-gold flex items-center justify-center shadow-lg">
                    <CheckCircle2 className="w-5 h-5 md:w-7 md:h-7 text-accent-foreground" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </main>

      <footer className="shrink-0 p-3 md:p-5 border-t border-primary-foreground/10 bg-primary/95 backdrop-blur shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
        <div className="max-w-7xl mx-auto flex justify-center items-center h-full">
          {showConfirm ? (
            <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-primary-foreground font-display font-bold text-xl md:text-3xl text-center">
                {selectedIds.length === 0 
                  ? `Confirmar ${blankCount} VOTO(S) EM BRANCO?`
                  : blankCount > 0 
                    ? `Confirmar ${selectedIds.length} candidato(s) e ${blankCount} VOTO(S) EM BRANCO?`
                    : `Confirmar voto em ${selectedIds.length} candidato(s)?`
                }
              </p>
              <div className="flex gap-4 w-full sm:w-auto">
                <Button variant="ghost" onClick={() => setShowConfirm(false)} className="flex-1 sm:flex-none text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground text-xl md:text-2xl py-8 px-6">
                  Corrigir
                </Button>
                <Button onClick={handleConfirm} className="flex-1 sm:flex-none bg-success text-success-foreground hover:bg-success/90 font-bold text-2xl md:text-3xl px-12 py-8 animate-pulse-ring">
                  CONFIRMAR
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => setShowConfirm(true)}
              className={`
                w-full md:w-auto font-bold text-2xl md:text-4xl px-8 py-8 md:px-24 md:py-10 shadow-xl transition-all
                ${selectedIds.length === 0 ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80' : 'bg-gold text-accent-foreground hover:bg-gold-light'}
              `}
            >
              {selectedIds.length === 0 ? (
                `VOTAR EM BRANCO (${blankCount})`
              ) : (
                <><Vote className="w-8 h-8 md:w-10 md:h-10 mr-3" /> VOTAR ({selectedIds.length}/{effectiveMax})</>
              )}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
