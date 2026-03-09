import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LogIn, UserPlus, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import logoIpnb from '@/assets/logo_ipnb.png';

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      const result = login(username, password);
      if (result.success) {
        toast.success('Login realizado com sucesso!');
        navigate('/admin');
      } else {
        toast.error(result.message);
      }
    } else {
      const result = register(username, password);
      if (result.success) {
        toast.success(result.message);
        setMode('login');
        setUsername('');
        setPassword('');
      } else {
        toast.error(result.message);
      }
    }
  };

  return (
    <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-foreground/10 flex items-center justify-center">
            <Vote className="w-8 h-8 text-gold" />
          </div>
          <h1 className="text-2xl font-display font-bold text-primary-foreground">
            {mode === 'login' ? 'Acesso Administrativo' : 'Novo Cadastro'}
          </h1>
          <p className="text-sm text-primary-foreground/50 mt-1">
            Igreja Presbiteriana do Brasil
          </p>
        </div>

        <Card className="border-primary-foreground/10 bg-primary-foreground/5">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-primary-foreground/70">Usuário</Label>
                <Input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Digite seu usuário"
                  className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/30"
                />
              </div>
              <div>
                <Label className="text-primary-foreground/70">Senha</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/30"
                />
              </div>
              <Button type="submit" className="w-full bg-gold text-accent-foreground hover:bg-gold-light">
                {mode === 'login' ? (
                  <><LogIn className="w-4 h-4 mr-2" /> Entrar</>
                ) : (
                  <><UserPlus className="w-4 h-4 mr-2" /> Cadastrar</>
                )}
              </Button>
            </form>

            <div className="mt-4 text-center">
              {mode === 'login' ? (
                <button onClick={() => setMode('register')} className="text-sm text-gold hover:text-gold-light underline">
                  Não tem conta? Cadastre-se
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-primary-foreground/40">
                    Novos usuários precisam ser aprovados por um administrador antes de acessar o sistema.
                  </p>
                  <button onClick={() => setMode('login')} className="text-sm text-gold hover:text-gold-light underline">
                    Já tem conta? Faça login
                  </button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Button variant="ghost" onClick={() => navigate('/')} className="text-primary-foreground/40 hover:text-primary-foreground hover:bg-primary-foreground/10">
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar ao Início
          </Button>
        </div>
      </div>
    </div>
  );
}
