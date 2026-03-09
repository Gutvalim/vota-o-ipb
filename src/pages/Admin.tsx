import { useState } from 'react';
import { useElection, Candidate, CandidateRole, ScrutinyType } from '@/contexts/ElectionContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ArrowLeft, Plus, Trash2, Play, Square, AlertTriangle, Users, Award, RotateCcw, UserPlus, LogOut, CheckCircle2, XCircle, ShieldCheck, Eye
} from 'lucide-react';
import { toast } from 'sonner';

const ROLE_LABELS: Record<CandidateRole, string> = {
  presbitero: 'Presbítero',
  presbitero_vencimento: 'Presbítero em Vencimento',
  diacono: 'Diácono',
  diacono_vencimento: 'Diácono em Vencimento',
  membro: 'Membro',
};

export default function Admin() {
  const { state, dispatch, resolveScrutinyResults } = useElection();
  const { currentUser, users, logout, approveUser, rejectUser } = useAuth();
  const navigate = useNavigate();

  const [showCandidateForm, setShowCandidateForm] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [form, setForm] = useState({ name: '', photo: '', birthDate: '', currentRole: 'membro' as CandidateRole });
  const [startingScrutinyType, setStartingScrutinyType] = useState<ScrutinyType | null>(null);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  if (!currentUser) {
    navigate('/login');
    return null;
  }

  const currentScrutiny = state.scrutinies.find(s => s.id === state.currentScrutinyId);
  const isVotingOpen = currentScrutiny?.status === 'open';
  const pendingUsers = users.filter(u => !u.approved);

  const handleSaveElection = (field: string, value: string | number) => {
    dispatch({ type: 'SET_ELECTION', payload: { [field]: value } });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm(f => ({ ...f, photo: ev.target?.result as string }));
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

    setSelectedParticipants(eligibleCandidates.map(c => c.id));
    setStartingScrutinyType(type);
  };

  const handleConfirmStartScrutiny = () => {
    if (!startingScrutinyType) return;
    if (selectedParticipants.length === 0) {
      toast.error('Selecione pelo menos um candidato');
      return;
    }
    const existingRounds = state.scrutinies.filter(s => s.type === startingScrutinyType).length;
    dispatch({
      type: 'START_SCRUTINY',
      payload: { type: startingScrutinyType, round: existingRounds + 1, participatingCandidateIds: selectedParticipants },
    });
    toast.success(`Votação iniciada — ${existingRounds + 1}º escrutínio`);
    setStartingScrutinyType(null);
    setSelectedParticipants([]);
  };

  const handleCloseScrutiny = () => {
    if (!state.currentScrutinyId) return;
    dispatch({ type: 'CLOSE_SCRUTINY', payload: state.currentScrutinyId });
    toast.success('Votação encerrada');
  };

  const handleRestartScrutiny = () => {
    if (!state.currentScrutinyId) return;
    if (confirm('Tem certeza? Isso vai apagar TODOS os votos computados nesta rodada atual da urna!')) {
      dispatch({ type: 'RESTART_SCRUTINY', payload: state.currentScrutinyId });
      toast.info('A rodada atual foi reiniciada. Urnas liberadas.');
    }
  };

  const handleApproveResults = (scrutinyId: string) => {
    dispatch({ type: 'APPROVE_RESULTS', payload: scrutinyId });
    toast.success('Resultado liberado para o Data Show');
  };

  const handleReset = () => {
    if (confirm('Tem certeza que deseja resetar toda a eleição? Os candidatos serão mantidos, mas os votos e vagas serão zerados.')) {
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

  return (
    <div className="min-h-screen bg-background">
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
                {pendingUsers.map(u => (
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
            <div><Label>Título da Eleição</Label><Input value={state.title} onChange={e => handleSaveElection('title', e.target.value)} /></div>
            <div><Label>Data</Label><Input type="date" value={state.date} onChange={e => handleSaveElection('date', e.target.value)} /></div>
            <div><Label>Meta de Votantes (Quórum)</Label><Input type="number" min={0} value={state.voterGoal || ''} onChange={e => handleSaveElection('voterGoal', parseInt(e.target.value) || 0)} /></div>
            <div><Label>Vagas Presbíteros</Label><Input type="number" min={0} value={state.presbyterSlots || ''} onChange={e => handleSaveElection('presbyterSlots', parseInt(e.target.value) || 0)} /></div>
            <div><Label>Vagas Diáconos</Label><Input type="number" min={0} value={state.deaconSlots || ''} onChange={e => handleSaveElection('deaconSlots', parseInt(e.target.value) || 0)} /></div>
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
              <div className="p-4 rounded-lg bg-muted border-2 border-gold/30 space-y-4">
                <div>
                  <h3 className="font-display font-bold text-lg">
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
                <div className="flex gap-2">
                  <Button onClick={handleConfirmStartScrutiny} className="bg-gold text-accent-foreground hover:bg-gold-light"><Play className="w-4 h-4 mr-1" /> Confirmar ({selectedParticipants.length})</Button>
                  <Button variant="ghost" onClick={() => setStartingScrutinyType(null)}>Cancelar</Button>
                </div>
              </div>
            )}

            {isVotingOpen && currentScrutiny && (
              <div className="p-4 rounded-lg bg-success/10 border border-success/30">
                <p className="font-semibold text-success flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  Votação em andamento: {currentScrutiny.type === 'presbitero' ? 'Presbíteros' : 'Diáconos'} — {currentScrutiny.round}º escrutínio
                </p>
                <p className="text-sm text-muted-foreground mt-1">Votos computados: {currentScrutiny.totalVotes} / {state.voterGoal}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button variant="destructive" size="sm" onClick={handleCloseScrutiny}>
                    <Square className="w-4 h-4 mr-1" /> Encerrar Votação
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleRestartScrutiny} className="border-destructive text-destructive hover:bg-destructive/10">
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
                <h3 className="font-semibold text-sm text-muted-foreground mb-2">Escrutínios Encerrados</h3>
                <div className="space-y-2">
                  {state.scrutinies.filter(s => s.status === 'closed').map(s => {
                    const sorted = Object.entries(s.votes).filter(([id]) => s.participatingCandidateIds.includes(id)).sort((a, b) => b[1] - a[1]);
                    return (
                      <div key={s.id} className="p-3 rounded border bg-muted/50 text-sm">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold">{s.type === 'presbitero' ? 'Presbíteros' : 'Diáconos'} — {s.round}º escrutínio ({s.totalVotes} votos)</p>
                          {!s.resultsApproved ? (
                            <Button size="sm" onClick={() => handleApproveResults(s.id)} className="bg-gold text-accent-foreground hover:bg-gold-light">
                              <Eye className="w-4 h-4 mr-1" /> Aprovar Resultado
                            </Button>
                          ) : <Badge className="bg-success text-success-foreground">✓ Liberado</Badge>}
                        </div>
                        <div className="space-y-1">
                          {sorted.map(([cId, v]) => (
                            <div key={cId} className="flex justify-between">
                              <span className={s.electedIds.includes(cId) ? 'font-bold text-success' : ''}>{s.electedIds.includes(cId) && '✓ '}{state.candidates.find(x => x.id === cId)?.name}</span>
                              <span className="font-mono">{v} votos</span>
                            </div>
                          ))}
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
  );
}
