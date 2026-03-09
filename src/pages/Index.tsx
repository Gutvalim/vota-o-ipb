import { useNavigate } from 'react-router-dom';
import { Vote, Settings, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoIpnb from '@/assets/logo_ipnb.png';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-primary p-6">
      <div className="text-center max-w-2xl">
        <div className="mb-8">
          <img src={logoIpnb} alt="Igreja Presbiteriana de Nova Brasília" className="w-32 h-32 mx-auto mb-6 rounded-full object-contain" />
          <h1 className="text-4xl md:text-5xl font-display font-bold text-primary-foreground mb-3">
            Sistema de Votação
          </h1>
          <p className="text-lg text-primary-foreground/70 font-display">
            Igreja Presbiteriana do Brasil
          </p>
        </div>

        <p className="text-primary-foreground/60 mb-12 text-lg">
          Sistema eletrônico para eleição de Presbíteros e Diáconos
        </p>

        <div className="grid gap-4 sm:grid-cols-3 max-w-lg mx-auto">
          <Button
            onClick={() => navigate('/login')}
            className="h-auto py-6 flex flex-col gap-2 bg-primary-foreground/10 border border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20"
          >
            <Settings className="w-6 h-6" />
            <span className="text-sm font-semibold">Administração</span>
          </Button>

          <Button
            onClick={() => navigate('/urna')}
            className="h-auto py-6 flex flex-col gap-2 bg-gold text-accent-foreground hover:bg-gold-light"
          >
            <Vote className="w-6 h-6" />
            <span className="text-sm font-semibold">Urna</span>
          </Button>

          <Button
            onClick={() => navigate('/datashow')}
            className="h-auto py-6 flex flex-col gap-2 bg-primary-foreground/10 border border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20"
          >
            <Monitor className="w-6 h-6" />
            <span className="text-sm font-semibold">Data Show</span>
          </Button>
        </div>
      </div>

      <footer className="absolute bottom-6 text-primary-foreground/30 text-sm">
        IPB — Soli Deo Gloria
      </footer>
    </div>
  );
};

export default Index;
