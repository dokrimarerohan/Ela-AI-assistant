import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register service worker for installable PWA experience
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('Ela ServiceWorker registration successful with scope: ', reg.scope);
      })
      .catch((err) => {
        console.warn('Ela ServiceWorker registration failed: ', err);
      });
  });
}

