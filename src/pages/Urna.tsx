import { useState } from 'react';
import { useElection } from '@/contexts/ElectionContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2, Vote, Users, Sun, Moon } from 'lucide-react';
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
  const [highContrast, setHighContrast] = useState(false); // NOVO: Estado do Alto Contraste

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
  
  const blankCount = effectiveMax - selectedIds.length;

  const toggleCandidate = (id: string) => {
    if (hasVoted) return;
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= effectiveMax) {
        toast.error(`Você só pode selecionar até ${effectiveMax} candidato(s)`, {
          position: 'top-center',
          duration: 3500,
        });
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
      <div className="h-screen flex flex-col items-center justify-center bg-primary p-8 overflow-hidden relative">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="absolute top-4 left-4 text-primary-foreground/30 hover:text-primary-foreground hover:bg-primary-foreground/10">
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <Vote className="w-24 h-24 text-gold mb-6" />
        <h1 className="text-4xl md:text-5xl font-display font-bold text-primary-foreground mb-4 text-center">
          {state.title || 'Sistema de Votação'}
        </h1>
        <p className="text-primary-foreground/60 text-2xl mb-8 text-center">
          {votingClosed ? 'A votação foi encerrada. Aguarde o resultado.' : 'Nenhuma votação em andamento no momento.'}
        </p>
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
    <div className="h-screen bg-primary flex flex-col overflow-hidden relative">
      <header className="shrink-0 p-3 md:p-4 border-b border-primary-foreground/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="text-primary-foreground/20 hover:text-primary-foreground hover:bg-primary-foreground/10">
                <ArrowLeft className="w-7 h-7" />
              </Button>
              {/* NOVO: Botão de Alto Contraste */}
              <Button 
                variant="outline" 
                onClick={() => setHighContrast(!highContrast)}
                className={`transition-colors border-2 ${highContrast ? 'bg-white text-black border-white hover:bg-gray-200' : 'bg-transparent text-primary-foreground border-primary-foreground/30 hover:bg-primary-foreground/10'}`}
              >
                {highContrast ? <Moon className="w-5 h-5 mr-2" /> : <Sun className="w-5 h-5 mr-2" />}
                <span className="font-bold">{highContrast ? 'Modo Escuro' : 'Alto Contraste'}</span>
              </Button>
            </div>
            <div className="ml-2 md:ml-0">
              <h1 className="text-2xl md:text-3xl font-display font-bold text-primary-foreground leading-none">
                {currentScrutiny.type === 'presbitero' ? 'Presbíteros' : 'Diáconos'}
              </h1>
              <p className="text-lg md:text-xl text-primary-foreground/60 mt-1">
                {currentScrutiny.round}º Turno — Escolha até {effectiveMax} nome(s)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-primary-foreground/10 px-5 py-2 md:py-3 rounded-xl hidden sm:flex">
            <span className="text-primary-foreground/60 text-lg md:text-xl font-bold">Escolhidos:</span>
            <span className={`font-bold text-2xl md:text-3xl ${selectedIds.length === effectiveMax ? 'text-gold' : 'text-primary-foreground'}`}>
              {selectedIds.length}/{effectiveMax}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-2 md:p-4 overflow-y-auto">
        <div className="w-full max-w-7xl flex flex-wrap justify-center gap-3 md:gap-5">
          {participatingCandidates.map(c => {
            const isSelected = selectedIds.includes(c.id);
            
            // Lógica de cores baseada no Alto Contraste
            const cardBaseStyle = highContrast
              ? 'bg-white border-[3px] border-gray-300 hover:bg-gray-100'
              : 'bg-primary-foreground/5 border-[3px] border-transparent hover:bg-primary-foreground/10';
              
            const cardSelectedStyle = highContrast
              ? 'bg-gray-200 border-[3px] border-black ring-4 ring-black/30 scale-[1.02]'
              : 'bg-gold/20 border-[3px] border-gold ring-4 ring-gold/30 scale-[1.02]';
              
            const textStyle = highContrast ? 'text-black' : 'text-primary-foreground';
            const iconBgStyle = highContrast ? 'bg-gray-100' : 'bg-primary-foreground/10';
            const iconColorStyle = highContrast ? 'text-gray-500' : 'text-primary-foreground/30';
            const checkBgStyle = highContrast ? 'bg-black text-white' : 'bg-gold text-accent-foreground';

            return (
              <button
                key={c.id}
                onClick={() => toggleCandidate(c.id)}
                className={`
                  w-[45%] sm:w-[30%] md:w-[22%] lg:w-[18%] max-w-[220px] shrink-0
                  relative p-3 md:p-4 rounded-xl transition-all duration-200 text-center flex flex-col items-center justify-center
                  ${isSelected ? cardSelectedStyle : cardBaseStyle}
                `}
              >
                <div className={`w-16 h-16 md:w-24 md:h-24 mb-3 rounded-full overflow-hidden shrink-0 shadow-lg ${iconBgStyle}`}>
                  {c.photo ? (
                    <img src={c.photo} alt={c.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Users className={`w-8 h-8 md:w-12 md:h-12 ${iconColorStyle}`} />
                    </div>
                  )}
                </div>
                <p className={`font-bold text-xl md:text-2xl leading-tight line-clamp-2 ${textStyle}`}>
                  {c.name}
                </p>
                {isSelected && (
                  <div className={`absolute top-2 right-2 md:top-3 md:right-3 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shadow-lg ${checkBgStyle}`}>
                    <CheckCircle2 className="w-5 h-5 md:w-7 md:h-7" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </main>

      {/* NOVO RODAPÉ: Botões ancorados à direita para o "Toque Duplo" */}
      <footer className="shrink-0 p-3 md:p-4 border-t border-primary-foreground/10 bg-primary/95 backdrop-blur shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-full">
          
          {/* Lado Esquerdo: Mensagens */}
          <div className="flex-1 pr-4 hidden sm:block">
            {showConfirm ? (
              <p className="text-primary-foreground font-display font-bold text-lg md:text-2xl">
                {selectedIds.length === 0 
                  ? `Confirmar ${blankCount} VOTO(S) EM BRANCO?`
                  : blankCount > 0 
                    ? `Confirmar ${selectedIds.length} candidato(s) e ${blankCount} VOTO(S) EM BRANCO?`
                    : `Confirmar voto em ${selectedIds.length} candidato(s)?`
                }
              </p>
            ) : (
              <div className="flex items-center gap-3">
                <Vote className="w-8 h-8 text-primary-foreground/30" />
                <p className="text-primary-foreground/50 text-xl font-bold">
                  Selecione os nomes acima e toque em VOTAR à direita.
                </p>
              </div>
            )}
          </div>

          {/* Lado Direito: Botões Ancorados */}
          <div className="flex items-center justify-end gap-3 w-full sm:w-auto shrink-0">
            {showConfirm && (
              <Button variant="ghost" onClick={() => setShowConfirm(false)} className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground text-lg md:text-xl py-6 md:py-8 px-4 md:px-6">
                Corrigir
              </Button>
            )}
            
            <Button
              onClick={showConfirm ? handleConfirm : () => setShowConfirm(true)}
              className={`
                font-bold text-xl md:text-3xl py-6 md:py-8 shadow-xl transition-all flex-1 sm:flex-none
                w-full sm:w-[260px] md:w-[320px] /* Tamanho fixo garante que o botão não mude de lugar */
                ${showConfirm ? 'bg-success text-success-foreground hover:bg-success/90 animate-pulse-ring' : 
                  selectedIds.length === 0 ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80' : 'bg-gold text-accent-foreground hover:bg-gold-light'}
              `}
            >
              {showConfirm ? (
                'CONFIRMAR'
              ) : selectedIds.length === 0 ? (
                `VOTAR EM BRANCO`
              ) : (
                <><Vote className="w-6 h-6 md:w-8 md:h-8 mr-2" /> VOTAR ({selectedIds.length})</>
              )}
            </Button>
          </div>

        </div>
        {/* Mensagem mobile extra caso a tela seja muito pequena */}
        {showConfirm && (
          <p className="text-primary-foreground font-bold text-center mt-3 sm:hidden">
            {selectedIds.length === 0 ? `Confirmar ${blankCount} BRANCOS?` : `Confirmar ${selectedIds.length} candidato(s)?`}
          </p>
        )}
      </footer>
    </div>
  );
}
