import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui.js/client';
import { SuiWalletProvider } from "@/hooks/useSuiWallet";
import Home from "@/pages/Home";
import Battle from "@/pages/Battle";
import NotFound from "@/pages/not-found";
import '@mysten/dapp-kit/dist/index.css';

const networks = {
  mainnet: { url: getFullnodeUrl('mainnet') },
};

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/battle" component={Battle} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networks} defaultNetwork="mainnet">
        <WalletProvider autoConnect>
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
