import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { atualizarManifestPwa } from './services/pwaManifest.js';
import { registrarServiceWorker } from './services/serviceWorkerRegistration.js';
import './index.css';

atualizarManifestPwa();
registrarServiceWorker();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
