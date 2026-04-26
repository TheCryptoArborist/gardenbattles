import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { SuiWalletProvider } from "@/hooks/useSuiWallet";
import { SUI_CONFIG } from "@/lib/sui-config";
import Home from "@/pages/Home";
import Battle from "@/pages/Battle";
import Mint from "@/pages/Mint";
import NotFound from "@/pages/not-found";
import '@mysten/dapp-kit/dist/index.css';

// Use exact SUI MAIN PUBLIC FULL NODE ENDPOINTS
const networks = {
  mainnet: { url: SUI_CONFIG.RPC_URL },
};

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/mint" component={Mint} />
      <Route path="/battle" component={Battle} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networks} defaultNetwork="mainnet">
        <WalletProvider autoConnect preferredWallets={['Sui Wallet']}>
          <SuiWalletProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </SuiWalletProvider>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}

export default App;
