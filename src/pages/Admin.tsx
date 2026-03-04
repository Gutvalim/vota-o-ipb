import { useState } from 'react';
import { useElection, Candidate, CandidateRole } from '@/contexts/ElectionContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Plus, Trash2, Play, Square, AlertTriangle, Users, Award, RotateCcw, UserPlus
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
  const { state, dispatch } = useElection();
  const navigate = useNavigate();
  const [showCandidateForm, setShowCandidateForm] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [form, setForm] = useState({ name: '', photo: '', birthDate: '', currentRole: 'membro' as CandidateRole });

  const currentScrutiny = state.scrutinies.find(s => s.id === state.currentScrutinyId);
  const isVotingOpen = currentScrutiny?.status === 'open';

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
      const candidate: Candidate = {
        id: crypto.randomUUID(),
        ...form,
      };
      dispatch({ type: 'ADD_CANDIDATE', payload: candidate });
      toast.success('Candidato adicionado');
    }
    setForm({ name: '', photo: '', birthDate: '', currentRole: 'membro' });
    setShowCandidateForm(false);
  };

  const handleStartScrutiny = (type: 'presbitero' | 'diacono') => {
    const existingRounds = state.scrutinies.filter(s => s.type === type).length;
    dispatch({ type: 'START_SCRUTINY', payload: { type, round: existingRounds + 1 } });
    toast.success(`Votação de ${type === 'presbitero' ? 'Presbíteros' : 'Diáconos'} iniciada — ${existingRounds + 1}º escrutínio`);
  };

  const handleCloseScrutiny = () => {
    if (!state.currentScrutinyId) return;
    dispatch({ type: 'CLOSE_SCRUTINY', payload: state.currentScrutinyId });
    toast.success('Votação encerrada');
  };

  const handleReset = () => {
    if (confirm('Tem certeza que deseja resetar toda a eleição? Esta ação não pode ser desfeita.')) {
      dispatch({ type: 'RESET' });
      toast.info('Eleição resetada');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground p-4 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="text-primary-foreground hover:bg-primary-foreground/10">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-display font-bold">Painel Administrativo</h1>
            <p className="text-sm text-primary-foreground/60">Configuração da Eleição</p>
          </div>
          <div className="ml-auto">
            <Button variant="ghost" size="sm" onClick={handleReset} className="text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10">
              <RotateCcw className="w-4 h-4 mr-1" /> Resetar
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        {/* Alerts */}
        {state.alerts.length > 0 && (
          <Card className="border-gold bg-gold/5">
            <CardContent className="pt-4">
              {state.alerts.map((alert, i) => (
                <div key={i} className="flex items-start gap-2 text-sm mb-2">
                  <AlertTriangle className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                  <span>{alert}</span>
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'CLEAR_ALERTS' })} className="mt-2 text-muted-foreground">
                Limpar alertas
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Election Config */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Award className="w-5 h-5 text-gold" />
              Configuração da Eleição
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label>Título da Eleição</Label>
              <Input value={state.title} onChange={e => handleSaveElection('title', e.target.value)} placeholder="Ex: Eleição de Oficiais 2026" />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={state.date} onChange={e => handleSaveElection('date', e.target.value)} />
            </div>
            <div>
              <Label>Meta de Votantes (Quórum)</Label>
              <Input type="number" min={0} value={state.voterGoal || ''} onChange={e => handleSaveElection('voterGoal', parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <Label>Vagas para Presbíteros</Label>
              <Input type="number" min={0} value={state.presbyterSlots || ''} onChange={e => handleSaveElection('presbyterSlots', parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <Label>Vagas para Diáconos</Label>
              <Input type="number" min={0} value={state.deaconSlots || ''} onChange={e => handleSaveElection('deaconSlots', parseInt(e.target.value) || 0)} />
            </div>
          </CardContent>
        </Card>

        {/* Candidates */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="w-5 h-5 text-gold" />
                Candidatos ({state.candidates.length})
              </CardTitle>
              <Button size="sm" onClick={() => { setShowCandidateForm(true); setEditingCandidate(null); setForm({ name: '', photo: '', birthDate: '', currentRole: 'membro' }); }}
                disabled={isVotingOpen}
              >
                <UserPlus className="w-4 h-4 mr-1" /> Adicionar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {showCandidateForm && (
              <div className="mb-6 p-4 rounded-lg bg-muted space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Nome</Label>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome completo" />
                  </div>
                  <div>
                    <Label>Data de Nascimento</Label>
                    <Input type="date" value={form.birthDate} onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Cargo Atual</Label>
                    <Select value={form.currentRole} onValueChange={v => setForm(f => ({ ...f, currentRole: v as CandidateRole }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(ROLE_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Foto</Label>
                    <Input type="file" accept="image/*" onChange={handlePhotoUpload} />
                    {form.photo && <img src={form.photo} alt="" className="w-12 h-12 rounded-full mt-2 object-cover" />}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddCandidate}>
                    {editingCandidate ? 'Salvar' : 'Adicionar'}
                  </Button>
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
                      {c.photo ? (
                        <img src={c.photo} alt={c.name} className="w-full h-full object-cover" />
                      ) : (
                        <Users className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{c.name}</p>
                      <Badge variant="secondary" className="text-xs">{ROLE_LABELS[c.currentRole]}</Badge>
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => dispatch({ type: 'REMOVE_CANDIDATE', payload: c.id })}
                      disabled={isVotingOpen}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scrutiny Control */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Gerenciar Escrutínios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isVotingOpen && currentScrutiny && (
              <div className="p-4 rounded-lg bg-success/10 border border-success/30">
                <p className="font-semibold text-success flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  Votação em andamento: {currentScrutiny.type === 'presbitero' ? 'Presbíteros' : 'Diáconos'} — {currentScrutiny.round}º escrutínio
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Votos computados: {currentScrutiny.totalVotes} / {state.voterGoal}
                </p>
                <Button variant="destructive" size="sm" className="mt-3" onClick={handleCloseScrutiny}>
                  <Square className="w-4 h-4 mr-1" /> Encerrar Votação
                </Button>
              </div>
            )}

            {!isVotingOpen && (
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => handleStartScrutiny('presbitero')}
                  disabled={state.candidates.length === 0 || state.presbyterSlots === 0}
                  className="bg-navy hover:bg-navy-light text-primary-foreground"
                >
                  <Play className="w-4 h-4 mr-1" /> Iniciar Votação — Presbíteros
                </Button>
                <Button onClick={() => handleStartScrutiny('diacono')}
                  disabled={state.candidates.length === 0 || state.deaconSlots === 0}
                  className="bg-navy hover:bg-navy-light text-primary-foreground"
                >
                  <Play className="w-4 h-4 mr-1" /> Iniciar Votação — Diáconos
                </Button>
              </div>
            )}

            {/* Past scrutinies */}
            {state.scrutinies.filter(s => s.status === 'closed').length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold text-sm text-muted-foreground mb-2">Escrutínios Encerrados</h3>
                <div className="space-y-2">
                  {state.scrutinies.filter(s => s.status === 'closed').map(s => {
                    const sorted = Object.entries(s.votes).sort((a, b) => b[1] - a[1]);
                    return (
                      <div key={s.id} className="p-3 rounded border bg-muted/50 text-sm">
                        <p className="font-semibold">
                          {s.type === 'presbitero' ? 'Presbíteros' : 'Diáconos'} — {s.round}º escrutínio ({s.totalVotes} votos)
                        </p>
                        <div className="mt-2 space-y-1">
                          {sorted.map(([candidateId, votes]) => {
                            const c = state.candidates.find(x => x.id === candidateId);
                            const slots = s.type === 'presbitero' ? state.presbyterSlots : state.deaconSlots;
                            const elected = s.type === 'presbitero' ? state.electedPresbyters : state.electedDeacons;
                            const isElected = elected.includes(candidateId);
                            return (
                              <div key={candidateId} className="flex items-center justify-between">
                                <span className={isElected ? 'font-bold text-success' : ''}>
                                  {isElected && '✓ '}{c?.name || 'Desconhecido'}
                                </span>
                                <span className="font-mono">{votes} votos</span>
                              </div>
                            );
                          })}
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
