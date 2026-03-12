import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Effects3DProvider } from './contexts/Effects3DContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Effects3DProvider>
      <App />
    </Effects3DProvider>
  </React.StrictMode>
);
