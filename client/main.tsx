import './styles/input.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';

import { router } from './app/router';
import { AtragraphModsProvider } from './context/AtragraphModsContext';
import { ThemeProvider } from './context/ThemeContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AtragraphModsProvider>
        <RouterProvider router={router} />
      </AtragraphModsProvider>
    </ThemeProvider>
  </StrictMode>,
);
