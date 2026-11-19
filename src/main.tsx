import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import AvatarLab from './AvatarLab.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    {new URLSearchParams(location.search).has('avatarlab') ? <AvatarLab /> : <App />}
  </ErrorBoundary>
);

