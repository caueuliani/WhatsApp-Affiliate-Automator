import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ("serviceWorker" in navigator && !["localhost", "127.0.0.1"].includes(window.location.hostname)) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/share-worker.js", { scope: "/" }).catch(() => {
      // Optional mobile share target; paste remains available.
    });
  });
}
