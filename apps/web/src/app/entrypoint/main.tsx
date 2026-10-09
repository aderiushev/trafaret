import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource/saira-stencil-one/latin-400.css';
import '@xyflow/react/dist/style.css';
import '../styles/tokens.css';
import '../styles/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const container = document.getElementById('root');
if (!container) throw new Error('The page has no #root element.');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
