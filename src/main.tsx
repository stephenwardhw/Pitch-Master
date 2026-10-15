import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';
import './print.css';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary fallbackTitle="Application Initialization Error">
    <App />
  </ErrorBoundary>
);
