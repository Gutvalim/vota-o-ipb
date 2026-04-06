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
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft, Plus, Trash2, Play, Square, AlertTriangle, Users, Award, RotateCcw, UserPlus, LogOut, CheckCircle2, XCircle, ShieldCheck, Eye, QrCode, Printer, Smartphone, Tablet, Search
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
  const { currentUser, users, logout, approveUser, rejectUser } = useAuth();
  const navigate = useNavigate();

  const [showCandidateForm, setShowCandidateForm] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [form, setForm] = useState({ name: '', photo: '', birthDate: '', currentRole: 'membro' as CandidateRole });
  const [startingScrutinyType, setStartingScrutinyType] = useState<ScrutinyType | null>(null);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  const [voterCountToGenerate, setVoterCountToGenerate] = useState<number | string>(1);
  const [printingVoters, setPrintingVoters] = useState<Voter[]>([]);
  const [searchVoter, setSearchVoter] = useState('');

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
  const pendingUsers = users.filter(u => !u.approved);
  const voters = state.voters || [];

  const handleSaveElection = (field: string, value: string | number) => {
    dispatch({ type: 'SET_ELECTION', payload: { [field]: value } });
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
    } else {
      const candidate: Candidate = { id: crypto.randomUUID(), ...form };
      dispatch({ type: 'ADD_CANDIDATE', payload: candidate });
    }
    setForm({ name: '', photo: '', birthDate: '', currentRole: 'membro' });
    setShowCandidateForm(false);
  };

  const handleInitiateStartScrutiny = (type: ScrutinyType) => {
    const alreadyElected = type === 'presbitero' ? state.electedPresbyters : state.electedDeacons;
    const previousScrutinies = state.scrutinies.filter(s => s.type === type && s.status === 'closed');
    const slots = type === 'presbitero' ? state.presbyterSlots : state.deaconSlots;
    let eligibleCandidates = state.candidates.filter(c => !alreadyElected.includes(c.id));
    setSelectedParticipants(eligibleCandidates.map(c => c.id));
    setStartingScrutinyType(type);
  };

  const handleConfirmStartScrutiny = async () => {
    if (!startingScrutinyType) return;
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
      setStartingScrutinyType(null);
    } catch (error: any) {
      toast.error("Erro ao iniciar: " + error.message);
    }
  };

  const handleGenerateVoters = () => {
    const count = parseInt(voterCountToGenerate.toString());
    const newVoters: Voter[] = [];
    for (let i = 0; i < count; i++) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      newVoters.push({ code, createdAt: Date.now() });
    }
    dispatch({ type: 'ADD_VOTERS', payload: newVoters });
    setVoterCountToGenerate(1);
  };

  const handlePrint = (votersToPrint: Voter[]) => {
    setPrintingVoters(votersToPrint);
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const sortedVoters = [...voters].sort((a, b) => b.createdAt - a.createdAt);
  const filteredVoters = sortedVoters.filter(v => v.code.includes(searchVoter));

  return (
    <>
      <style>{`
        @media screen {
          .print-only { display: none; }
        }
        @media print {
          @page { 
            margin: 0; 
            size: 58mm auto;
          }
          html, body {
            height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
            width: 58mm !important;
          }
          .ticket {
            width: 58mm !important;
            padding: 5mm !important;
            text-align: center;
            page-break-after: always;
            box-sizing: border-box;
          }
          .ticket:last-child {
            page-break-after: auto;
          }
        }
      `}</style>

      <div className="min-h-screen bg-background no-print pb-20">
        <header className="bg-primary text-primary-foreground p-4 shadow-lg">
          <div className="max-w-5xl mx-auto flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="text-primary-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">Painel Administrativo</h1>
            <Button variant="ghost" size="sm" onClick={() => logout()} className="ml-auto">Sair</Button>
          </div>
        </header>

        <main className="max-w-5xl mx-auto p-4 space-y-6">
          <Card>
            <CardHeader><CardTitle>Configuração</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div><Label>Título</Label><SyncInput value={state.title || ''} onChange={(val: string) => handleSaveElection('title', val)} /></div>
              <div><Label>Data</Label><SyncInput type="date" value={state.date || ''} onChange={(val: string) => handleSaveElection('date', val)} /></div>
              <div><Label>Meta</Label><SyncInput type="number" value={state.voterGoal?.toString() || ''} onChange={(val: string) => handleSaveElection('voterGoal', parseInt(val) || 0)} /></div>
            </CardContent>
          </Card>

          <Card className="border-blue-900 border-2">
            <CardHeader className="bg-blue-900/5">
              <CardTitle className="flex items-center gap-2">
                <QrCode className="w-5 h-5" /> Gerenciar Eleitores
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-end gap-3 bg-muted p-4 rounded-xl">
                <div className="w-full sm:w-32">
                  <Label>Qtde:</Label>
                  <Input type="number" value={voterCountToGenerate} onChange={e => setVoterCountToGenerate(e.target.value)} />
                </div>
                <Button onClick={handleGenerateVoters} className="bg-blue-600">Gerar</Button>
                <Button variant="outline" onClick={() => handlePrint(voters)} disabled={voters.length === 0}>Imprimir Todos</Button>
                <Button variant="destructive" onClick={() => dispatch({ type: 'CLEAR_VOTERS' } as any)}>Limpar</Button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Pesquisar..." value={searchVoter} onChange={(e) => setSearchVoter(e.target.value)} className="pl-9" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
                {filteredVoters.map(v => (
                  <div key={v.code} className="flex items-center justify-between bg-muted p-2 rounded border">
                    <span className="font-mono font-bold">{v.code}</span>
                    <div className="flex">
                      <Button variant="ghost" size="icon" onClick={() => handlePrint([v])}><Printer className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => {
                        const updated = voters.filter(x => x.code !== v.code);
                        dispatch({ type: 'SET_ELECTION', payload: { voters: updated } });
                      }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Candidatos</CardTitle>
                <Button onClick={() => setShowCandidateForm(true)}>Adicionar</Button>
              </div>
            </CardHeader>
            <CardContent>
              {showCandidateForm && (
                <div className="mb-4 p-4 bg-muted rounded space-y-3">
                  <Input placeholder="Nome" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                  <Input type="date" value={form.birthDate} onChange={e => setForm({...form, birthDate: e.target.value})} />
                  <Input type="file" accept="image/*" onChange={handlePhotoUpload} />
                  <Button onClick={handleAddCandidate}>Salvar</Button>
                  <Button variant="ghost" onClick={() => setShowCandidateForm(false)}>Cancelar</Button>
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                {state.candidates.map(c => (
                  <div key={c.id} className="flex items-center gap-3 p-2 border rounded">
                    <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden">
                      {c.photo && <img src={c.photo} className="w-full h-full object-cover" />}
                    </div>
                    <span className="flex-1 font-semibold">{c.name}</span>
                    <Button variant="ghost" size="icon" onClick={() => dispatch({ type: 'REMOVE_CANDIDATE', payload: c.id })}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Escrutínios</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {!isVotingOpen ? (
                <div className="flex gap-2">
                  <Button onClick={() => handleInitiateStartScrutiny('presbitero')}>Presbíteros</Button>
                  <Button onClick={() => handleInitiateStartScrutiny('diacono')}>Diáconos</Button>
                </div>
              ) : (
                <div className="p-4 bg-green-50 border border-green-200 rounded">
                  <p className="font-bold text-green-700">Votação em Curso</p>
                  <Button variant="destructive" className="mt-2" onClick={() => dispatch({ type: 'CLOSE_SCRUTINY', payload: currentScrutiny!.id })}>Encerrar</Button>
                </div>
              )}
              
              {startingScrutinyType && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100]">
                  <Card className="w-full max-w-md">
                    <CardHeader><CardTitle>Iniciar Votação</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant={authMode === 'pin' ? 'default' : 'outline'} onClick={() => setAuthMode('pin')}>Mesário (PIN)</Button>
                        <Button variant={authMode === 'code' ? 'default' : 'outline'} onClick={() => setAuthMode('code')}>Membros (QR)</Button>
                      </div>
                      {authMode === 'pin' && <Input placeholder="PIN de 4 dígitos" value={customPin} onChange={e => setCustomPin(e.target.value)} />}
                      <div className="flex gap-2">
                        <Button onClick={handleConfirmStartScrutiny} className="flex-1">Começar</Button>
                        <Button variant="ghost" onClick={() => setStartingScrutinyType(null)}>Sair</Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* ÁREA DE IMPRESSÃO (LIMPA) */}
      <div className="print-only">
        {printingVoters.map((v, index) => (
          <div key={v.code} className="ticket">
            <div style={{ fontWeight: 'bold', fontSize: '14px' }}>IPB NOVA BRASÍLIA</div>
            <div style={{ fontSize: '10px', marginBottom: '10px' }}>ASSEMBLEIA EXTRAORDINÁRIA</div>
            
            <div style={{ borderTop: '1px dashed black', borderBottom: '1px dashed black', padding: '10px 0', margin: '10px 0' }}>
              <div style={{ fontSize: '10px' }}>CÓDIGO DE ACESSO</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', fontFamily: 'monospace' }}>{v.code}</div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }}>
              <QRCodeSVG value={v.code} size={120} level="M" />
            </div>
            
            <div style={{ fontSize: '10px', marginTop: '10px', lineHeight: '1.2' }}>
              Aproxime este QR Code da câmera<br />na tela de identificação da urna.
            </div>
            <div style={{ fontSize: '9px', marginTop: '5px', opacity: 0.7 }}>
              Uso único e intransferível.
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
