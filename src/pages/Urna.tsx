import { useState, useEffect } from 'react';
import { useElection } from '@/contexts/ElectionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Camera, CheckCircle2, Lock, Smartphone, User, UserCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

export default function Urna() {
  const { state, dispatch } = useElection();
  
  const currentScrutiny = state.scrutinies.find(s => s.id === state.currentScrutinyId);
  const isVotingOpen = currentScrutiny?.status === 'open';

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [voterCode, setVoterCode] = useState('');
  const [isCodeValidated, setIsCodeValidated] = useState(false);
  const [pin, setPin] = useState('');
  const [isPinValidated, setIsPinValidated] = useState(false);
  
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (isVotingOpen && currentScrutiny?.authMode === 'code') {
      const urlParams = new URLSearchParams(window.location.search);
      const codeFromUrl = urlParams.get('codigo');
      if (codeFromUrl) {
        setVoterCode(codeFromUrl);
        const isValid = state.voters?.some(v => v.code === codeFromUrl);
        const hasVoted = currentScrutiny.votedCodes?.includes(codeFromUrl);
        
        if (isValid && !hasVoted) {
          setIsCodeValidated(true);
          toast.success("Código validado pela URL. Urna liberada!");
        } else if (hasVoted) {
          toast.error("Este código já foi utilizado neste escrutínio.");
        } else {
          toast.error("Código da URL inválido.");
        }
      }
    }
  }, [isVotingOpen, currentScrutiny?.authMode, state.voters, currentScrutiny?.votedCodes]);

  useEffect(() => {
    setSelectedIds([]);
  }, [state.currentScrutinyId]);

  let codeReader: BrowserMultiFormatReader | null = null;

  const startScanner = async () => {
    setIsScanning(true);
    codeReader = new BrowserMultiFormatReader();
    try {
      const videoInputDevices = await codeReader.listVideoInputDevices();
      const selectedDeviceId = videoInputDevices.length > 0 ? videoInputDevices[videoInputDevices.length - 1].deviceId : undefined;
      
      codeReader.decodeFromVideoDevice(selectedDeviceId, 'video', (result, err) => {
        if (result) {
          const text = result.getText();
          let extractedCode = text;
          if (text.includes('codigo=')) {
            const urlObj = new URL(text);
            extractedCode = urlObj.searchParams.get('codigo') || text;
          }

          setVoterCode(extractedCode);
          codeReader?.reset();
          setIsScanning(false);
          validateCode(extractedCode);
        }
        if (err && !(err instanceof NotFoundException)) {
          console.error(err);
        }
      });
    } catch (error) {
      console.error(error);
      toast.error("Erro ao acessar a câmera.");
      setIsScanning(false);
    }
  };

  const stopScanner = () => {
    codeReader?.reset();
    setIsScanning(false);
  };

  const validateCode = (codeToValidate: string) => {
    if (!currentScrutiny) return;
    const isValid = state.voters?.some(v => v.code === codeToValidate);
    const hasVoted = currentScrutiny.votedCodes?.includes(codeToValidate);

    if (hasVoted) {
      toast.error('Este código já depositou um voto neste escrutínio!');
    } else if (isValid) {
      setIsCodeValidated(true);
      toast.success('Código validado! Urna liberada para votar.');
    } else {
      toast.error('Código inválido. Verifique o papel e tente novamente.');
    }
  };

  const validatePin = () => {
    if (!currentScrutiny) return;
    if (pin === currentScrutiny.pin) {
      setIsPinValidated(true);
      toast.success('Urna liberada pelo Mesário!');
    } else {
      toast.error('PIN incorreto.');
      setPin('');
    }
  };

  const handleNumpadCode = (num: string) => {
    if (voterCode.length < 6) setVoterCode(prev => prev + num);
  };
  const handleNumpadCodeBackspace = () => setVoterCode(prev => prev.slice(0, -1));

  const handleNumpadPin = (num: string) => {
    if (pin.length < 4) setPin(prev => prev + num);
  };
  const handleNumpadPinBackspace = () => setPin(prev => prev.slice(0, -1));

  if (!isVotingOpen || !currentScrutiny) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center py-12 shadow-xl border-t-4 border-t-gold">
          <Lock className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
          <h2 className="text-2xl font-display font-bold text-slate-800">Urna Fechada</h2>
          <p className="text-muted-foreground mt-2">Aguarde o mesário iniciar o próximo escrutínio.</p>
        </Card>
      </div>
    );
  }

  const isAuthCode = currentScrutiny.authMode === 'code';
  const isAuthPin = currentScrutiny.authMode === 'pin';

  if (isAuthCode && !isCodeValidated) {
    return (
      <div className="min-h-screen bg-blue-900 flex items-center justify-center p-4">
        <Card className="max-w-sm w-full p-6 shadow-2xl border-none bg-white rounded-2xl">
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <Smartphone className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Identifique-se</h2>
              <p className="text-sm text-slate-500 mt-1">Digite os 6 números do seu papel ou leia o QR Code.</p>
            </div>

            <div className="space-y-4 pt-4">
              <div className="relative">
                <Input 
                  type="text" 
                  value={voterCode} 
                  readOnly 
                  className="text-center text-3xl font-mono tracking-[0.5em] py-6 bg-slate-50 border-slate-300 shadow-inner"
                  placeholder="------"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                  <Button key={num} variant="outline" className="h-14 text-xl font-semibold bg-white hover:bg-slate-100 border-slate-200" onClick={() => handleNumpadCode(num.toString())}>
                    {num}
                  </Button>
                ))}
                <Button variant="outline" className="h-14 text-lg font-bold bg-slate-100 text-red-500 hover:bg-red-50 border-slate-200" onClick={handleNumpadCodeBackspace}>
                  DEL
                </Button>
                <Button variant="outline" className="h-14 text-xl font-semibold bg-white hover:bg-slate-100 border-slate-200" onClick={() => handleNumpadCode('0')}>
                  0
                </Button>
                <Button className="h-14 bg-blue-600 hover:bg-blue-700 text-white font-bold" onClick={() => validateCode(voterCode)} disabled={voterCode.length < 6}>
                  OK
                </Button>
              </div>

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink-0 mx-4 text-slate-400 text-sm">OU</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              {!isScanning ? (
                <Button variant="outline" className="w-full h-14 border-blue-200 text-blue-700 hover:bg-blue-50" onClick={startScanner}>
                  <Camera className="w-5 h-5 mr-2" /> Ler QR Code da Câmera
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="rounded-xl overflow-hidden border-2 border-blue-500 bg-black aspect-square max-h-64 relative">
                    <video id="video" className="w-full h-full object-cover"></video>
                    <div className="absolute inset-0 border-[3px] border-dashed border-white/50 m-8 rounded-lg pointer-events-none animate-pulse"></div>
                  </div>
                  <Button variant="ghost" className="w-full text-slate-500" onClick={stopScanner}>Cancelar Câmera</Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (isAuthPin && !isPinValidated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-sm w-full p-6 shadow-2xl border-none bg-white rounded-2xl">
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-gold/20 rounded-full flex items-center justify-center mx-auto mb-2">
              <Lock className="w-8 h-8 text-gold" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Urna Bloqueada</h2>
              <p className="text-sm text-slate-500 mt-1">Solicite ao mesário para liberar a urna.</p>
            </div>

            <div className="space-y-4 pt-4">
              <Input 
                type="password" 
                value={pin} 
                readOnly 
                className="text-center text-3xl font-mono tracking-[0.5em] py-6 bg-slate-50 border-slate-300 shadow-inner"
                placeholder="••••"
              />
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                  <Button key={num} variant="outline" className="h-14 text-xl font-semibold bg-white hover:bg-slate-100 border-slate-200" onClick={() => handleNumpadPin(num.toString())}>
                    {num}
                  </Button>
                ))}
                <Button variant="outline" className="h-14 text-lg font-bold bg-slate-100 text-red-500 hover:bg-red-50 border-slate-200" onClick={handleNumpadPinBackspace}>
                  DEL
                </Button>
                <Button variant="outline" className="h-14 text-xl font-semibold bg-white hover:bg-slate-100 border-slate-200" onClick={() => handleNumpadPin('0')}>
                  0
                </Button>
                <Button className="h-14 bg-gold hover:bg-yellow-500 text-black font-bold" onClick={validatePin} disabled={pin.length < 4}>
                  LBR
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const typeLabel = currentScrutiny.type === 'presbitero' ? 'Presbítero' : 'Diácono';
  const slots = currentScrutiny.type === 'presbitero' ? state.presbyterSlots : state.deaconSlots;
  const alreadyElectedCount = currentScrutiny.type === 'presbitero' ? state.electedPresbyters.length : state.electedDeacons.length;
  const remainingSlots = slots - alreadyElectedCount;
  
  const participatingCandidates = state.candidates.filter(c => currentScrutiny.participatingCandidateIds.includes(c.id));

  const handleToggleCandidate = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= remainingSlots) {
        toast.error(`Você só pode escolher até ${remainingSlots} candidato(s)`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleVote = () => {
    if (selectedIds.length === 0 && !confirm('Você não selecionou nenhum candidato. Seu voto será computado em BRANCO. Deseja confirmar?')) {
      return;
    }

    try {
      // COMANDO CORRETO: CAST_VOTE, passando o scrutinyId junto
      dispatch({ 
        type: 'CAST_VOTE', 
        payload: { 
          scrutinyId: currentScrutiny.id,
          candidateIds: selectedIds,
          voterCode: isAuthCode ? voterCode : undefined
        } 
      });
      
      toast.success('Voto registrado com sucesso!');
      
      setSelectedIds([]);
      if (isAuthCode) {
        setVoterCode('');
        setIsCodeValidated(false);
      } else {
        setPin('');
        setIsPinValidated(false);
      }
      
      window.scrollTo(0,0);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleBlankVote = () => {
    if (confirm('Tem certeza que deseja votar em BRANCO?')) {
      try {
        // COMANDO CORRETO: CAST_VOTE, passando array vazio para branco
        dispatch({ 
          type: 'CAST_VOTE', 
          payload: { 
            scrutinyId: currentScrutiny.id,
            candidateIds: [],
            voterCode: isAuthCode ? voterCode : undefined
          } 
        });
        toast.success('Voto em branco registrado.');
        setSelectedIds([]);
        if (isAuthCode) {
          setVoterCode('');
          setIsCodeValidated(false);
        } else {
          setPin('');
          setIsPinValidated(false);
        }
        window.scrollTo(0,0);
      } catch(error: any) {
        toast.error(error.message);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 relative pb-32"> {/* Proteção do rodapé */}
      
      {/* CABEÇALHO FIXO */}
      <header className="bg-primary text-primary-foreground p-4 md:p-6 shadow-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold leading-tight">
                Eleição para {typeLabel}
              </h1>
              <p className="text-primary-foreground/80 font-medium text-sm md:text-base mt-1">
                {currentScrutiny.round}º Escrutínio — Você pode escolher até <strong className="text-white text-lg">{remainingSlots}</strong> candidato(s)
              </p>
            </div>
            
            <div className="flex items-center justify-between md:justify-end gap-4 bg-primary-foreground/10 p-3 rounded-lg border border-primary-foreground/20">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-gold" />
                <span className="font-semibold text-sm md:text-base">Selecionados:</span>
              </div>
              <Badge variant="secondary" className="bg-white text-primary text-lg md:text-xl px-4 py-1 font-bold shadow-sm">
                {selectedIds.length} / {remainingSlots}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* ÁREA DA LISTA DE CANDIDATOS (COM ESPAÇAMENTO pt-6) */}
      <main className="max-w-4xl mx-auto p-4 md:p-6 pt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {participatingCandidates.map(c => {
            const isSelected = selectedIds.includes(c.id);
            return (
              <Card 
                key={c.id} 
                className={`cursor-pointer transition-all duration-200 border-2 overflow-hidden ${isSelected ? 'border-gold bg-gold/10 shadow-lg scale-[1.02]' : 'border-border/50 hover:border-gold/50 hover:shadow-md bg-white'}`}
                onClick={() => handleToggleCandidate(c.id)}
              >
                <CardContent className="p-0 flex items-center h-24 md:h-28">
                  <div className={`w-24 md:w-28 h-full shrink-0 flex items-center justify-center bg-muted border-r ${isSelected ? 'border-gold/30' : 'border-border'}`}>
                    {c.photo ? (
                      <img src={c.photo} alt={c.name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-10 h-10 text-muted-foreground/50" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 p-3 md:p-4 flex flex-col justify-center">
                    <p className={`font-bold text-base md:text-lg truncate leading-tight ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                      {c.name}
                    </p>
                    {isSelected && (
                      <div className="flex items-center gap-1.5 mt-1 text-gold font-semibold text-sm">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Selecionado</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>

      {/* RODAPÉ FIXO PARA OS BOTÕES DE VOTO */}
      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 shadow-[0_-4px_15px_rgba(0,0,0,0.05)] p-4 md:p-6 z-50">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-3 md:gap-4">
          <Button 
            variant="outline" 
            size="lg" 
            onClick={handleBlankVote} 
            className="w-full sm:w-1/3 h-14 md:h-16 text-base md:text-lg font-bold border-slate-300 text-slate-600 hover:bg-slate-100"
          >
            Votar em Branco
          </Button>
          <Button 
            size="lg" 
            onClick={handleVote} 
            disabled={selectedIds.length === 0}
            className={`w-full sm:w-2/3 h-14 md:h-16 text-lg md:text-xl font-black uppercase tracking-wider transition-all shadow-md ${selectedIds.length > 0 ? 'bg-success hover:bg-green-600 text-white' : 'bg-slate-200 text-slate-400'}`}
          >
            CONFIRMAR VOTO
          </Button>
        </div>
      </div>

    </div>
  );
}
