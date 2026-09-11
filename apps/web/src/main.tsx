import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { ThemeProvider } from './components/theme-provider.tsx';
import { TooltipProvider } from './components/ui/tooltip.tsx';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark">
      <TooltipProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>,
);
