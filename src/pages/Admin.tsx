import { useState, useEffect } from 'react';
import { useElection, Candidate, CandidateRole, ScrutinyType, Voter } from '@/contexts/ElectionContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
// Mantemos o Canvas para blindar a memória do celular
import { QRCodeCanvas } from 'qrcode.react';
import {
  ArrowLeft, Plus, Trash2, Play, Square, AlertTriangle, Users, Award, RotateCcw, UserPlus, LogOut, CheckCircle2, XCircle, ShieldCheck, Eye, QrCode, Printer, Smartphone, Tablet, Search, UserMinus, Settings, Tag
} from 'lucide-react';
import { toast } from 'sonner';

const ROLE_LABELS: Record<CandidateRole, string> = {
  presbitero: 'Presbítero',
  presbitero_vencimento: 'Presbítero em Vencimento',
  diacono: 'Diácono',
  diacono_vencimento: 'Diácono em Vencimento',
  membro: 'Membro',
};

function SyncInput({ value, onChange, ...props }: any) {
  const [localValue, setLocalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) setLocalValue(value);
  }, [value, isFocused]);

  return (
    <Input
      {...props}
      value={isFocused ? localValue : value}
      onFocus={() => setIsFocused(true)}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={() => {
        setIsFocused(false);
        if (localValue !== value) onChange(localValue);
      }}
    />
  );
}

export default function Admin() {
  const { state, dispatch } = useElection();
  const { currentUser, users, logout, approveUser, rejectUser, deleteUser } = useAuth() as any;
  const navigate = useNavigate();

  const [showCandidateForm, setShowCandidateForm] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [form, setForm] = useState({ name: '', photo: '', birthDate: '', currentRole: 'membro' as CandidateRole });
  const [startingScrutinyType, setStartingScrutinyType] = useState<ScrutinyType | null>(null);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  const [voterCountToGenerate, setVoterCountToGenerate] = useState<number | string>(1);
  const [printingVoters, setPrintingVoters] = useState<Voter[]>([]);
  const [searchVoter, setSearchVoter] = useState('');
  
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showManageUsersModal, setShowManageUsersModal] = useState(false);

  // Estados para o novo sistema de Tags (Nomes)
  const [taggingVoterCode, setTaggingVoterCode] = useState<string | null>(null);
  const [newTagValue, setNewTagValue] = useState('');

  const [authMode, setAuthMode] = useState<'pin' | 'code'>('pin');
  const [customPin, setCustomPin] = useState('4321');

  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintingVoters([]);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  if (!currentUser) {
    navigate('/login');
    return null;
  }

  const currentScrutiny = state.scrutinies.find(s => s.id === state.currentScrutinyId);
  const isVotingOpen = currentScrutiny?.status === 'open';
  
  const pendingUsers = users.filter((u: any) => !u.approved);
  const approvedUsers = users.filter((u: any) => u.approved && u.username !== currentUser.username);
  
  const voters = state.voters || [];
  const votedCodesList = currentScrutiny?.votedCodes || [];

  const handleSaveElection = (field: string, value: string | number) => {
    dispatch({ type: 'SET_ELECTION', payload: { [field]: value } });
  };

  const handleRemoveUser = (username: string) => {
    if (confirm(`Tem certeza que deseja REVOGAR O ACESSO do usuário '${username}'?`)) {
      if (deleteUser) deleteUser(username);
      else rejectUser(username);
      toast.info(`Acesso de ${username} removido.`);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 300; 
        const MAX_HEIGHT = 300;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        setForm(f => ({ ...f, photo: compressedBase64 }));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleAddCandidate = () => {
    if (!form.name || !form.birthDate) {
      toast.error('Preencha nome e data de nascimento');
      return;
    }
    if (editingCandidate) {
      dispatch({ type: 'UPDATE_CANDIDATE', payload: { ...editingCandidate, ...form } });
      setEditingCandidate(null);
      toast.success('Candidato atualizado');
    } else {
      const candidate: Candidate = { id: crypto.randomUUID(), ...form };
      dispatch({ type: 'ADD_CANDIDATE', payload: candidate });
      toast.success('Candidato adicionado');
    }
    setForm({ name: '', photo: '', birthDate: '', currentRole: 'membro' });
    setShowCandidateForm(false);
  };

  const handleInitiateStartScrutiny = (type: ScrutinyType) => {
    const alreadyElected = type === 'presbitero' ? state.electedPresbyters : state.electedDeacons;
    const previousScrutinies = state.scrutinies.filter(s => s.type === type && s.status === 'closed');
    const lastScrutiny = previousScrutinies[previousScrutinies.length - 1];
    const slots = type === 'presbitero' ? state.presbyterSlots : state.deaconSlots;
    const remainingSlots = slots - alreadyElected.length;
    const nextRound = previousScrutinies.length + 1;

    let eligibleCandidates = state.candidates.filter(c => !alreadyElected.includes(c.id));
    let initialSelected: string[] = [];

    if (nextRound === 1) {
      if (eligibleCandidates.length < (slots * 2)) {
        initialSelected = eligibleCandidates.map(c => c.id);
      } else {
        initialSelected = [];
      }
    } else {
      if (lastScrutiny) {
        eligibleCandidates = eligibleCandidates.filter(c => lastScrutiny.participatingCandidateIds.includes(c.id));
      }
      if (nextRound >= 3 && lastScrutiny) {
        const sortedFromLast = Object.entries(lastScrutiny.votes)
          .filter(([id]) => lastScrutiny.participatingCandidateIds.includes(id) && !alreadyElected.includes(id))
          .sort((a, b) => {
            if (b[1] !== a[1]) return b[1] - a[1];
            const ca = state.candidates.find(c => c.id === a[0]);
            const cb = state.candidates.find(c => c.id === b[0]);
            if (!ca || !cb) return 0;
            return new Date(ca.birthDate).getTime() - new Date(cb.birthDate).getTime();
          });
        const funnelCount = remainingSlots * 2;
        const funnelIds = sortedFromLast.slice(0, funnelCount).map(([id]) => id);
        eligibleCandidates = eligibleCandidates.filter(c => funnelIds.includes(c.id));
      }
      initialSelected = eligibleCandidates.map(c => c.id);
    }
    setSelectedParticipants(initialSelected);
    setStartingScrutinyType(type);
    setAuthMode('pin'); 
    setCustomPin('4321');
  };

  const handleConfirmStartScrutiny = async () => {
    if (!startingScrutinyType) return;
    if (selectedParticipants.length === 0) {
      toast.error('Selecione pelo menos um candidato');
      return;
    }
    if (authMode === 'pin' && (!customPin || customPin.length < 4)) {
      toast.error('O PIN do mesário deve ter pelo menos 4 dígitos.');
      return;
    }
    if (authMode === 'code' && voters.length === 0) {
      toast.error('Não há eleitores cadastrados. Vá na aba Gerenciar Eleitores primeiro.');
      return;
    }
    const existingRounds = state.scrutinies.filter(s => s.type === startingScrutinyType).length;
    try {
      await dispatch({
        type: 'START_SCRUTINY',
        payload: { 
          type: startingScrutinyType, 
          round: existingRounds + 1, 
          participatingCandidateIds: selectedParticipants,
          authMode: authMode,
          pin: authMode === 'pin' ? customPin : ""
        },
      });
      toast.success(`Votação iniciada no modo: ${authMode === 'pin' ? 'Tablet/Mesário' : 'Celular (QR Code)'}`);
      setStartingScrutinyType(null);
      setSelectedParticipants([]);
    } catch (error: any) {
      toast.error("Falha ao iniciar escrutínio no servidor: " + error.message);
    }
  };

  const handleCloseScrutiny = () => {
    if (!state.currentScrutinyId) return;
    dispatch({ type: 'CLOSE_SCRUTINY', payload: state.currentScrutinyId });
    toast.success('Votação encerrada');
    setShowPendingModal(false);
  };

  const handleRestartScrutiny = (scrutinyId: string) => {
    if (confirm('Atenção: Isso vai APAGAR TODOS os votos computados neste escrutínio e reabrir a votação! Deseja continuar?')) {
      dispatch({ type: 'RESTART_SCRUTINY', payload: scrutinyId });
      toast.info('O escrutínio foi reiniciado e as urnas reabertas.');
    }
  };

  const handleApproveResults = (scrutinyId: string) => {
    dispatch({ type: 'APPROVE_RESULTS', payload: scrutinyId });
    toast.success('Resultado liberado para o Data Show');
  };

  const handleReset = () => {
    if (confirm('Tem certeza que deseja resetar toda a eleição? Os candidatos e códigos serão mantidos, mas os resultados zerados.')) {
      dispatch({ type: 'RESET' });
      toast.info('Eleição resetada.');
    }
  };

  const handleClearCandidates = () => {
    if (confirm('Tem certeza que deseja apagar TODOS os candidatos?')) {
      dispatch({ type: 'CLEAR_CANDIDATES' } as any);
      toast.info('Candidatos apagados.');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getScrutinyInfo = (type: ScrutinyType) => {
    const alreadyElected = type === 'presbitero' ? state.electedPresbyters : state.electedDeacons;
    const slots = type === 'presbitero' ? state.presbyterSlots : state.deaconSlots;
    const remainingSlots = slots - alreadyElected.length;
    const previousRounds = state.scrutinies.filter(s => s.type === type && s.status === 'closed').length;
    const nextRound = previousRounds + 1;
    return { remainingSlots, nextRound, alreadyElected };
  };

  // Funções de Eleitores (Voters)
  const handleGenerateVoters = () => {
    const count = parseInt(voterCountToGenerate.toString());
    if (isNaN(count) || count <= 0 || count > 500) {
      toast.error('Informe uma quantidade válida (Max: 500 por vez).');
      return;
    }
    const newVoters: Voter[] = [];
    for (let i = 0; i < count; i++) {
      let code;
      let isDuplicate;
      do {
        code = Math.floor(100000 + Math.random() * 900000).toString();
        isDuplicate = voters.some(v => v.code === code) || newVoters.some(v => v.code === code);
      } while (isDuplicate);
      // Incluímos a propriedade tag opcional vazia na criação
      newVoters.push({ code, createdAt: Date.now(), tag: '' });
    }
    dispatch({ type: 'ADD_VOTERS', payload: newVoters });
    toast.success(`${count} códigos gerados com sucesso!`);
    setVoterCountToGenerate(1);
  };

  const handleClearVoters = () => {
    if (confirm('ATENÇÃO: Isso apagará TODOS os códigos gerados. Eleitores não poderão votar se seus códigos forem apagados. Continuar?')) {
      dispatch({ type: 'CLEAR_VOTERS' } as any);
      toast.info('Todos os códigos de eleitores foram apagados.');
    }
  };

  const handleDeleteSingleVoter = (codeToRemove: string) => {
    if (confirm(`Tem certeza que deseja excluir o código ${codeToRemove}?`)) {
      const updatedVoters = voters.filter(v => v.code !== codeToRemove);
      dispatch({ type: 'SET_ELECTION', payload: { voters: updatedVoters } });
      toast.success(`Código ${codeToRemove} excluído.`);
    }
  };

  // Função para salvar a TAG do eleitor
  const handleSaveTag = () => {
    if (!taggingVoterCode) return;
    
    const updatedVoters = voters.map(v => 
      v.code === taggingVoterCode ? { ...v, tag: newTagValue.trim() } : v
    );
    
    dispatch({ type: 'SET_ELECTION', payload: { voters: updatedVoters } });
    toast.success('Nome/Tag salvo com sucesso!');
    setTaggingVoterCode(null);
    setNewTagValue('');
  };

  const openTagModal = (voter: Voter) => {
    setTaggingVoterCode(voter.code);
    setNewTagValue(voter.tag || '');
  };

  // A IMPRESSÃO RAIZ (Na mesma página, tanto PC quanto Mobile)
  const handlePrint = (votersToPrint: Voter[]) => {
    if (votersToPrint.length === 0) return;

    // Jogamos os tickets na memória. O CSS cuidará do resto.
    setPrintingVoters(votersToPrint);

    // Damos 800ms pro React desenhar o Canvas.
    setTimeout(() => {
      window.print();
    }, 800);
  };

  // Filtro de Busca (agora pesquisa pelo CÓDIGO ou pelo NOME/TAG)
  const sortedVoters = [...voters].sort((a, b) => b.createdAt - a.createdAt);
  const filteredVoters = sortedVoters.filter(v => {
    const searchTerm = searchVoter.toLowerCase();
    return v.code.includes(searchTerm) || (v.tag && v.tag.toLowerCase().includes(searchTerm));
  });

  return (
    <>
      <style>{`
        /* A Div Invisível que funciona no PC e no mobile */
        @media screen { 
          .print-container { 
            position: absolute !important;
            width: 1px !important;
            height: 1px !important;
            padding: 0 !important;
            margin: -1px !important;
            overflow: hidden !important;
            clip: rect(0, 0, 0, 0) !important;
            white-space: nowrap !important;
            border: 0 !important;
          } 
        }

        /* Regras de formatação do papel térmico */
        @media print {
          @page { margin: 0; size: 58mm auto; }
          html, body { height: auto !important; overflow: visible !important; background: white !important; margin: 0 !important; padding: 0 !important; }
          .no-print { display: none !important; }
          .print-container { position: relative !important; left: 0 !important; top: 0 !important; opacity: 1 !important; display: block !important; width: 58mm !important; margin: 0 auto !important; padding: 0 !important; }
          .ticket { width: 58mm !important; padding: 5mm !important; text-align: center; box-sizing: border-box; }
        }
      `}</style>

      <div className="min-h-screen bg-background no-print pb-10">
        <header className="bg-primary text-primary-foreground p-4 shadow-lg">
          <div className="max-w-5xl mx-auto flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="text-primary-foreground hover:bg-primary-foreground/10">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-display font-bold">Painel Administrativo</h1>
              <p className="text-sm text-primary-foreground/60">Logado como: {currentUser.username}</p>
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleReset} className="text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10">
                <RotateCcw className="w-4 h-4 mr-1" /> Resetar Eleição
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10">
                <LogOut className="w-4 h-4 mr-1" /> Sair
              </Button>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
          
          {currentUser.isAdmin && pendingUsers.length > 0 && (
            <Card className="border-gold bg-gold/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShieldCheck className="w-5 h-5 text-gold" />
                  Usuários Aguardando Aprovação ({pendingUsers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pendingUsers.map((u: any) => (
                    <div key={u.username} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <span className="font-semibold">{u.username}</span>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => { approveUser(u.username); toast.success(`${u.username} aprovado`); }} className="bg-success text-success-foreground hover:bg-success/90">
                          <CheckCircle2 className="w-4 h-4 mr-1" /> Aprovar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => { rejectUser(u.username); toast.info(`${u.username} rejeitado`); }}>
                          <XCircle className="w-4 h-4 mr-1" /> Rejeitar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {currentUser.isAdmin && approvedUsers.length > 0 && (
            <div className="flex justify-end">
               <Button 
                 variant="outline" 
                 onClick={() => setShowManageUsersModal(true)}
                 className="border-slate-300 text-slate-700 hover:bg-slate-100 shadow-sm"
               >
                 <Settings className="w-4 h-4 mr-2" />
                 Gerenciar Acessos do Sistema
               </Button>
            </div>
          )}

          {state.alerts.length > 0 && (
            <Card className="border-gold bg-gold/5">
              <CardContent className="pt-4">
                {state.alerts.map((alert, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm mb-2">
                    <AlertTriangle className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                    <span>{alert}</span>
                  </div>
                ))}
                <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'CLEAR_ALERTS' })} className="mt-2 text-muted-foreground">Limpar alertas</Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Award className="w-5 h-5 text-gold" /> Configuração da Eleição
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div><Label>Título da Eleição</Label><SyncInput value={state.title || ''} onChange={(val: string) => handleSaveElection('title', val)} /></div>
              <div><Label>Data</Label><SyncInput type="date" value={state.date || ''} onChange={(val: string) => handleSaveElection('date', val)} /></div>
              <div><Label>Meta de Votantes (Opcional)</Label><SyncInput type="number" min={0} value={state.voterGoal?.toString() || ''} onChange={(val: string) => handleSaveElection('voterGoal', parseInt(val) || 0)} /></div>
              <div><Label>Vagas Presbíteros</Label><SyncInput type="number" min={0} value={state.presbyterSlots?.toString() || ''} onChange={(val: string) => handleSaveElection('presbyterSlots', parseInt(val) || 0)} /></div>
              <div><Label>Vagas Diáconos</Label><SyncInput type="number" min={0} value={state.deaconSlots?.toString() || ''} onChange={(val: string) => handleSaveElection('deaconSlots', parseInt(val) || 0)} /></div>
            </CardContent>
          </Card>

          <Card className="border-blue-900 border-2">
            <CardHeader className="bg-blue-900/5 pb-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <CardTitle className="flex items-center gap-2 text-lg text-blue-900 dark:text-blue-400">
                  <QrCode className="w-5 h-5" /> 
                  Gerenciar Eleitores (Acesso Via Celular)
                </CardTitle>
                <Badge variant="outline" className="bg-blue-100 text-blue-900 border-blue-300 font-bold px-3 py-1 text-sm">
                  {voters.length} Eleitor(es) Cadastrados
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Gere códigos, imprima QR Codes e adicione <strong>Nomes (Tags)</strong> para rastrear quem recebeu qual papel.
              </p>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 bg-muted/50 p-4 rounded-xl border border-border/50">
                <div className="flex items-end gap-2 w-full sm:w-auto">
                  <div className="flex-1 sm:w-48">
                    <Label>Gerar nova quantidade:</Label>
                    <Input 
                      type="number" 
                      min={1} max={500}
                      value={voterCountToGenerate} 
                      onChange={e => setVoterCountToGenerate(e.target.value)} 
                      className="mt-1"
                    />
                  </div>
                  <Button onClick={handleGenerateVoters} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Gerar</span>
                  </Button>
                </div>
                
                <div className="flex-1 hidden sm:block"></div>
                
                <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                  <Button variant="outline" onClick={() => handlePrint(voters)} disabled={voters.length === 0} className="w-full border-blue-600 text-blue-600 hover:bg-blue-50 px-2 sm:px-4 text-xs sm:text-sm">
                    <Printer className="w-4 h-4 mr-1 md:mr-2" /> Imprimir<span className="hidden sm:inline">&nbsp;Todos</span>
                  </Button>
                  <Button variant="destructive" onClick={handleClearVoters} disabled={voters.length === 0 || isVotingOpen} className="w-full px-2 sm:px-4 text-xs sm:text-sm">
                    <Trash2 className="w-4 h-4 mr-1 md:mr-2" /> Excluir<span className="hidden sm:inline">&nbsp;Todos</span>
                  </Button>
                </div>
              </div>
              
              {voters.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      placeholder="Pesquisar código ou nome..." 
                      value={searchVoter}
                      onChange={(e) => setSearchVoter(e.target.value)}
                      className="pl-9 bg-background"
                    />
                  </div>
                  
                  {isVotingOpen && currentScrutiny?.authMode === 'code' && (
                    <Button 
                      variant="secondary" 
                      onClick={() => setShowPendingModal(true)} 
                      className="w-full sm:w-auto bg-yellow-500/20 text-yellow-700 hover:bg-yellow-500/30 border border-yellow-500/50"
                    >
                      <Users className="w-4 h-4 mr-2" /> Faltam Votar ({voters.length - votedCodesList.length})
                    </Button>
                  )}
                </div>
              )}

              {filteredVoters.length > 0 ? (
                // O GRID EMPILHADO PERFEITO PARA MOBILE
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[400px] overflow-y-auto p-2 border rounded-lg bg-card">
                  {filteredVoters.map(v => {
                    const hasVotedCurrentRound = isVotingOpen && currentScrutiny?.authMode === 'code' && votedCodesList.includes(v.code);
                    
                    return (
                      <div 
                        key={v.code} 
                        className={`flex flex-col p-2 border rounded-md transition-colors shadow-sm ${hasVotedCurrentRound ? 'bg-success/10 border-success/30' : 'bg-muted/30'}`}
                      >
                        {/* Linha 1: Código e Status */}
                        <div className="flex items-start justify-between mb-1">
                          <span className={`font-mono font-bold text-base md:text-lg tracking-wider ${hasVotedCurrentRound ? 'text-success-foreground' : 'text-slate-800'}`}>
                            {v.code}
                          </span>
                          {isVotingOpen && currentScrutiny?.authMode === 'code' && (
                            <div>
                              {hasVotedCurrentRound ? (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-success/20 text-success uppercase tracking-wider">✓ Votou</span>
                              ) : (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-700 uppercase tracking-wider">Pendente</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Linha 2: O Nome (Tag) */}
                        <div className="text-xs text-muted-foreground truncate h-5 mb-1" title={v.tag || "Sem nome"}>
                          {v.tag ? (
                            <span className="font-semibold text-slate-700">{v.tag}</span>
                          ) : (
                            <span className="italic opacity-50 text-[10px]">Sem nome</span>
                          )}
                        </div>

                        {/* Linha 3: Os Botões (Alinhados no rodapé) */}
                        <div className="flex items-center justify-between border-t border-border/50 pt-2 mt-auto">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 bg-blue-100/50 hover:bg-blue-100 text-blue-700" 
                            onClick={() => openTagModal(v)} 
                            title="Adicionar/Editar Nome"
                          >
                            <Tag className="w-3.5 h-3.5" />
                          </Button>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:bg-slate-200 hover:text-slate-800" onClick={() => handlePrint([v])} title="Imprimir este">
                              <Printer className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:bg-red-100 hover:text-destructive" onClick={() => handleDeleteSingleVoter(v.code)} title="Excluir este">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                voters.length > 0 && (
                  <p className="text-center text-muted-foreground py-4 border rounded-lg bg-muted/20">
                    Nenhum resultado encontrado.
                  </p>
                )
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="w-5 h-5 text-gold" /> Candidatos ({state.candidates.length})
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="destructive" onClick={handleClearCandidates} disabled={state.candidates.length === 0 || isVotingOpen}>
                    <Trash2 className="w-4 h-4 mr-1" /> Apagar Todos
                  </Button>
                  <Button size="sm" onClick={() => { setShowCandidateForm(true); setEditingCandidate(null); setForm({ name: '', photo: '', birthDate: '', currentRole: 'membro' }); }} disabled={isVotingOpen}>
                    <UserPlus className="w-4 h-4 mr-1" /> Adicionar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {showCandidateForm && (
                <div className="mb-6 p-4 rounded-lg bg-muted space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                    <div><Label>Data de Nascimento</Label><Input type="date" value={form.birthDate} onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))} /></div>
                    <div>
                      <Label>Cargo Atual</Label>
                      <Select value={form.currentRole} onValueChange={v => setForm(f => ({ ...f, currentRole: v as CandidateRole }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(ROLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Foto</Label><Input type="file" accept="image/*" onChange={handlePhotoUpload} />
                      {form.photo && <img src={form.photo} alt="" className="w-12 h-12 rounded-full mt-2 object-cover" />}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddCandidate}>{editingCandidate ? 'Salvar' : 'Adicionar'}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowCandidateForm(false)}>Cancelar</Button>
                  </div>
                </div>
              )}
              {state.candidates.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum candidato cadastrado</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {state.candidates.map(c => (
                    <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                        {c.photo ? <img src={c.photo} alt={c.name} className="w-full h-full object-cover" /> : <Users className="w-5 h-5 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{c.name}</p>
                        <Badge variant="secondary" className="text-xs">{ROLE_LABELS[c.currentRole]}</Badge>
                      </div>
                      <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => dispatch({ type: 'REMOVE_CANDIDATE', payload: c.id })} disabled={isVotingOpen}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Gerenciar Escrutínios</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {startingScrutinyType && (
                <div className="p-4 rounded-lg bg-muted border-2 border-gold/30 space-y-6">
                  <div className="border-b border-border pb-4">
                    <h3 className="font-display font-bold text-xl">
                      Iniciar {startingScrutinyType === 'presbitero' ? 'Eleição de Presbíteros' : 'Eleição de Diáconos'}
                    </h3>
                    {(() => {
                      const info = getScrutinyInfo(startingScrutinyType);
                      return (
                        <div className="text-sm text-muted-foreground mt-1 space-y-1">
                          <p><strong>{info.nextRound}º Escrutínio</strong> — {info.remainingSlots} vaga(s) restante(s)</p>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="space-y-4 bg-background p-4 rounded-lg border">
                    <h4 className="font-bold text-md flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-gold" />
                      Método de Autenticação da Urna
                    </h4>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div 
                        className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${authMode === 'pin' ? 'border-gold bg-gold/5 shadow-md' : 'border-border hover:border-gold/50'}`}
                        onClick={() => setAuthMode('pin')}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 font-bold text-lg"><Tablet className="w-5 h-5"/> Tablets Físicos</div>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${authMode === 'pin' ? 'border-gold' : 'border-muted-foreground'}`}>
                            {authMode === 'pin' && <div className="w-2 h-2 bg-gold rounded-full" />}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">Mesário controla a fila. O eleitor vota e o mesário desbloqueia a urna com uma senha.</p>
                        {authMode === 'pin' && (
                          <div className="space-y-2 mt-auto" onClick={e => e.stopPropagation()}>
                            <Label>Defina o PIN do Mesário (4 dígitos):</Label>
                            <Input 
                              type="text" maxLength={4} value={customPin} 
                              onChange={e => setCustomPin(e.target.value.replace(/[^0-9]/g, ''))}
                              className="font-mono text-lg font-bold tracking-widest text-center"
                            />
                          </div>
                        )}
                      </div>
                      <div 
                        className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${authMode === 'code' ? 'border-blue-600 bg-blue-600/5 shadow-md' : 'border-border hover:border-blue-600/50'}`}
                        onClick={() => setAuthMode('code')}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 font-bold text-lg text-blue-600 dark:text-blue-400"><Smartphone className="w-5 h-5"/> Celular Pessoal</div>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${authMode === 'code' ? 'border-blue-600' : 'border-muted-foreground'}`}>
                            {authMode === 'code' && <div className="w-2 h-2 bg-blue-600 rounded-full" />}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">Cada eleitor acessa o site do próprio celular e escaneia o Código/QR Code individual.</p>
                        {authMode === 'code' && (
                          <div className="mt-4 bg-blue-600/10 p-3 rounded-lg border border-blue-600/20 text-sm text-blue-900 dark:text-blue-200">
                            <strong>Aviso:</strong> A urna só aceitará votos validados pelos {voters.length} códigos cadastrados.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {state.candidates.filter(c => !((startingScrutinyType === 'presbitero' ? state.electedPresbyters : state.electedDeacons).includes(c.id))).map(c => {
                        const isSelected = selectedParticipants.includes(c.id);
                        return (
                          <label key={c.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'bg-gold/10 border-gold/30' : 'bg-card hover:bg-muted'}`}>
                            <Checkbox checked={isSelected} onCheckedChange={(checked) => setSelectedParticipants(prev => checked ? [...prev, c.id] : prev.filter(id => id !== c.id))} />
                            <div className="min-w-0"><p className="font-semibold text-sm truncate">{c.name}</p></div>
                          </label>
                        );
                      })}
                  </div>
                  <div className="flex gap-2 pt-4 border-t border-border">
                    <Button onClick={handleConfirmStartScrutiny} className="bg-gold text-accent-foreground hover:bg-gold-light text-lg px-8"><Play className="w-5 h-5 mr-2" /> Iniciar Votação</Button>
                    <Button variant="ghost" onClick={() => setStartingScrutinyType(null)} className="text-lg">Cancelar</Button>
                  </div>
                </div>
              )}

              {isVotingOpen && currentScrutiny && (
                <div className="p-4 rounded-lg bg-success/10 border border-success/30">
                  <p className="font-semibold text-success flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                    Votação em andamento: {currentScrutiny.type === 'presbitero' ? 'Presbíteros' : 'Diáconos'} — {currentScrutiny.round}º escrutínio
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Votos computados: {currentScrutiny.totalVotes} / {currentScrutiny.authMode === 'code' ? voters.length : state.voterGoal}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button variant="destructive" size="sm" onClick={handleCloseScrutiny}>
                      <Square className="w-4 h-4 mr-1" /> Encerrar Votação
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleRestartScrutiny(currentScrutiny.id)} className="border-destructive text-destructive hover:bg-destructive/10">
                      <RotateCcw className="w-4 h-4 mr-1" /> Reiniciar Escrutínio Atual
                    </Button>
                  </div>
                </div>
              )}

              {!isVotingOpen && !startingScrutinyType && (
                <div className="flex flex-wrap gap-3">
                  {(() => {
                    const pInfo = getScrutinyInfo('presbitero');
                    return pInfo.remainingSlots > 0 ? (
                      <Button onClick={() => handleInitiateStartScrutiny('presbitero')} disabled={state.candidates.length === 0 || state.presbyterSlots === 0} className="bg-navy hover:bg-navy-light text-primary-foreground"><Play className="w-4 h-4 mr-1" /> Presbíteros ({pInfo.nextRound}º esc.)</Button>
                    ) : state.presbyterSlots > 0 ? <Badge variant="secondary" className="py-2 px-4">✅ Presbíteros preenchidos</Badge> : null;
                  })()}
                  {(() => {
                    const dInfo = getScrutinyInfo('diacono');
                    return dInfo.remainingSlots > 0 ? (
                      <Button onClick={() => handleInitiateStartScrutiny('diacono')} disabled={state.candidates.length === 0 || state.deaconSlots === 0} className="bg-navy hover:bg-navy-light text-primary-foreground"><Play className="w-4 h-4 mr-1" /> Diáconos ({dInfo.nextRound}º esc.)</Button>
                    ) : state.deaconSlots > 0 ? <Badge variant="secondary" className="py-2 px-4">✅ Diáconos preenchidos</Badge> : null;
                  })()}
                </div>
              )}

              {state.scrutinies.filter(s => s.status === 'closed').length > 0 && (
                <div className="mt-4">
                  <h3 className="font-semibold text-sm text-muted-foreground mb-4">Escrutínios Encerrados</h3>
                  <div className="space-y-4">
                    {state.scrutinies.filter(s => s.status === 'closed').reverse().map(s => {
                      const sorted = Object.entries(s.votes).filter(([id]) => s.participatingCandidateIds.includes(id)).sort((a, b) => b[1] - a[1]);
                      return (
                        <div key={s.id} className="p-4 rounded-lg border bg-muted/50 text-sm">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3 border-b pb-3 border-muted-foreground/20">
                            <p className="font-semibold text-base">
                              {s.type === 'presbitero' ? 'Presbíteros' : 'Diáconos'} — {s.round}º escrutínio ({s.totalVotes} votos)
                            </p>
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              {!isVotingOpen && (
                                <Button variant="outline" size="sm" onClick={() => handleRestartScrutiny(s.id)} className="text-destructive border-destructive hover:bg-destructive/10 whitespace-nowrap">
                                  <RotateCcw className="w-4 h-4 mr-1" /> Reiniciar
                                </Button>
                              )}
                              {!s.resultsApproved ? (
                                <Button size="sm" onClick={() => handleApproveResults(s.id)} className="bg-gold text-accent-foreground hover:bg-gold-light whitespace-nowrap">
                                  <Eye className="w-4 h-4 mr-1" /> Aprovar Resultado
                                </Button>
                              ) : (
                                <Badge className="bg-success text-success-foreground whitespace-nowrap px-3 py-1 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Liberado
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2">
                            {sorted.map(([cId, v]) => (
                              <div key={cId} className="flex justify-between items-center">
                                <span className={s.electedIds.includes(cId) ? 'font-bold text-success' : ''}>{s.electedIds.includes(cId) && '✓ '}{state.candidates.find(x => x.id === cId)?.name}</span>
                                <span className="font-mono bg-background px-2 py-0.5 rounded text-xs">{v} votos</span>
                              </div>
                            ))}
                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-muted-foreground/20">
                              <span className="font-semibold text-muted-foreground uppercase text-xs tracking-wider">Votos em Branco</span>
                              <span className="font-mono text-muted-foreground bg-background px-2 py-0.5 rounded text-xs">{s.blankVotes || 0} votos</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* JANELA DO NOME (TAG) PARA O ELEITOR */}
      {taggingVoterCode && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] no-print">
          <Card className="w-full max-w-sm shadow-2xl flex flex-col">
            <CardHeader className="shrink-0 border-b pb-4">
              <CardTitle className="text-xl flex items-center gap-2">
                <Tag className="w-5 h-5 text-blue-600" /> Identificar Eleitor
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Código: <strong className="font-mono text-black">{taggingVoterCode}</strong>
              </p>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3">
                <Label>Nome ou Apelido (Tag)</Label>
                <Input 
                  placeholder="Ex: Irmão João Silva" 
                  value={newTagValue}
                  onChange={(e) => setNewTagValue(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTag();
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Use isto para saber para quem você entregou este QR Code. 
                  Facilita a exclusão se ele perder o papel.
                </p>
              </div>
            </CardContent>
            <div className="p-4 border-t shrink-0 flex justify-end gap-2 bg-slate-50">
              <Button variant="outline" onClick={() => setTaggingVoterCode(null)}>Cancelar</Button>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSaveTag}>Salvar Nome</Button>
            </div>
          </Card>
        </div>
      )}

      {/* JANELA DE CÓDIGOS PENDENTES */}
      {showPendingModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] no-print">
          <Card className="w-full max-w-md shadow-2xl flex flex-col max-h-[85vh]">
            <CardHeader className="shrink-0 border-b pb-4">
              <CardTitle className="text-xl flex items-center gap-2">
                <Users className="w-5 h-5 text-yellow-600" /> Faltam Votar
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Estes códigos ainda não depositaram o voto na urna no turno atual.
              </p>
            </CardHeader>
            <CardContent className="overflow-y-auto flex-1 p-4 bg-muted/30">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {voters.filter(v => !votedCodesList.includes(v.code)).map(v => (
                  <div key={v.code} className="p-2 bg-white border border-yellow-500/30 rounded-md text-center shadow-sm flex flex-col items-center justify-center">
                    <span className="font-mono font-bold text-sm text-yellow-900">{v.code}</span>
                    {v.tag && <span className="text-[10px] text-muted-foreground truncate w-full mt-1" title={v.tag}>{v.tag}</span>}
                  </div>
                ))}
                {voters.filter(v => !votedCodesList.includes(v.code)).length === 0 && (
                  <div className="col-span-3 text-center text-muted-foreground py-8">
                    <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-2 opacity-50" />
                    Todos os eleitores já votaram!
                  </div>
                )}
              </div>
            </CardContent>
            <div className="p-4 border-t shrink-0">
              <Button className="w-full bg-navy hover:bg-navy-light text-primary-foreground" onClick={() => setShowPendingModal(false)}>
                Fechar Janela
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* JANELA DE GERENCIAR USUÁRIOS APROVADOS (MODAL) */}
      {showManageUsersModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] no-print">
          <Card className="w-full max-w-md shadow-2xl flex flex-col max-h-[85vh]">
            <CardHeader className="shrink-0 border-b pb-4 bg-slate-50">
              <CardTitle className="text-xl flex items-center gap-2 text-slate-800">
                <Settings className="w-5 h-5" /> Gerenciar Acessos
              </CardTitle>
              <p className="text-sm text-slate-500">
                Remova mesários ou administradores que não devem mais ter acesso ao sistema.
              </p>
            </CardHeader>
            <CardContent className="overflow-y-auto flex-1 p-4">
              <div className="space-y-3">
                {approvedUsers.map((u: any) => (
                  <div key={u.username} className="flex items-center justify-between p-3 rounded-lg border bg-white shadow-sm">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-700">{u.username}</span>
                      {u.isAdmin ? (
                        <Badge variant="secondary" className="w-fit mt-1 text-[10px] bg-blue-100 text-blue-800 border-blue-200">Administrador</Badge>
                      ) : (
                        <Badge variant="outline" className="w-fit mt-1 text-[10px] text-slate-500">Mesário</Badge>
                      )}
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-red-200 text-red-600 hover:bg-red-50" 
                      onClick={() => handleRemoveUser(u.username)}
                    >
                      <UserMinus className="w-4 h-4 mr-1" /> Remover
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
            <div className="p-4 border-t shrink-0 bg-slate-50">
              <Button variant="outline" className="w-full" onClick={() => setShowManageUsersModal(false)}>
                Fechar Janela
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MÓDULO DE IMPRESSÃO (NO PC E NO MOBILE FICA INVISÍVEL - TÉCNICA RAIZ) */}
      {printingVoters.length > 0 && (
        <div className="print-container font-sans text-black bg-white">
          {printingVoters.map((v, index) => (
            <div 
              key={v.code} 
              className="ticket"
              style={{ 
                pageBreakAfter: index === printingVoters.length - 1 ? 'auto' : 'always',
                breakInside: 'avoid'
              }}
            >
              <h2 style={{fontSize:'14px', margin:0, fontWeight: 'bold'}}>IPB NOVA BRASÍLIA</h2>
              <p style={{fontSize:'10px', margin:'2px 0 10px', fontWeight: 'bold'}}>ASSEMBLEIA EXTRAORDINÁRIA</p>
              
              <div style={{borderTop:'1px dashed #000', borderBottom:'1px dashed #000', padding:'10px 0', margin:'10px 0'}}>
                <span style={{fontSize:'10px', fontWeight: 'bold'}}>CÓDIGO DE ACESSO</span>
                <div style={{fontSize:'36px', fontWeight:'bold', fontFamily:'monospace'}}>{v.code}</div>
                {/* Se tiver tag cadastrada, imprime no papel pequenininho */}
                {v.tag && <div style={{fontSize:'10px', fontWeight:'normal', marginTop:'4px'}}>{v.tag}</div>}
              </div>
              
              <div style={{display:'flex', justifyContent:'center', margin:'10px 0'}}>
                {/* CANVAS PARA O CELULAR NÃO TRAVAR */}
                <QRCodeCanvas value={`https://vota.ipbnb.com.br/urna?codigo=${v.code}`} size={140} level="M" />
              </div>
              
              <p style={{fontSize:'10px', lineHeight:'1.2', marginTop: '10px'}}>
                Aponte a câmera do celular para este<br/>QR Code e a urna abrirá sozinha.
              </p>
              <p style={{fontSize:'8px', opacity:0.6, marginTop: '5px'}}>
                Uso único e intransferível.
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
