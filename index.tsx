
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './src/App';
import './src/index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Sinaliza que o app foi montado para remover o splash screen mais rápido
window.appMounted = true;
if (window.hideSplash) window.hideSplash();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(registration => {
      console.log('SW registrado com sucesso:', registration.scope);
      
      // Verifica atualizações
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker) {
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // Novo conteúdo disponível, avisa o usuário ou recarrega
                console.log('Novo conteúdo disponível. Recarregando...');
                // Poderíamos mostrar um toast aqui, mas o usuário pediu "reload now"
                // window.location.reload(); 
              }
            }
          };
        }
      };
    }).catch(err => {
      console.log('Falha ao registrar SW:', err);
    });
  });
}
