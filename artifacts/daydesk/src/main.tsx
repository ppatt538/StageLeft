import { createRoot } from 'react-dom/client';

import App from './App';

import './index.css';

// Apply stored theme immediately — before React mounts — to avoid a flash.
try {
  if (localStorage.getItem('daydesk-theme') === 'warm') {
    document.documentElement.setAttribute('data-theme', 'warm');
  }
} catch { /* ignore — private browsing etc */ }

createRoot(document.getElementById('root')!).render(<App />);
