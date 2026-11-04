import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createStore } from './app/store';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App store={createStore()} />
    </StrictMode>,
);
