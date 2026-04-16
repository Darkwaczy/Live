import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../src/App';  // ✅ let TS resolve
import './index.css';

window.onerror = (message, source, lineno, colno, error) => {
  console.error('GLOBAL ERROR:', message, 'at', source, lineno, ':', colno, error);
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
