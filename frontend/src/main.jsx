import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initSentry } from './monitoring/sentry.js';
import App from './App.jsx';
import './index.css';

initSentry();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
