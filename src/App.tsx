import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ElectionProvider } from "@/contexts/ElectionContext";
import Index from "./pages/Index";
import Admin from "./pages/Admin";
import Urna from "./pages/Urna";
import DataShow from "./pages/DataShow";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ElectionProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/urna" element={<Urna />} />
            <Route path="/datashow" element={<DataShow />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ElectionProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
