import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { registerAllNamePools } from './generation/registerPools';
import './styles/tokens.css';
import './styles/globals.css';
import './styles/components.css';

registerAllNamePools();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find #root element');
}

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
