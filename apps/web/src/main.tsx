import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { load } from './config.ts';
import { initI18n } from './i18n/index.ts';
import { router } from './routes/index.tsx';
import './styles.css';

/**
 * Configuration and language are both awaited before the first render.
 *
 * Configuration, because a component that reads it mid-render would see
 * nothing and every request would go to the wrong host. Language, because
 * rendering first shows a French reader a flash of English — brief, and the
 * kind of thing that reads as a broken product.
 */
async function start(): Promise<void> {
  const root = document.getElementById('root');

  if (root == null) {
    throw new Error('No #root element. index.html and main.tsx disagree.');
  }

  try {
    await load();
    await initI18n();
  } catch (error) {
    // Rendered as plain text, in English, deliberately: this is the one failure
    // that happens BEFORE there is a translator or a design system to render
    // it with, and a blank page here is the hardest thing to diagnose.
    root.textContent = `Soirely could not start: ${error instanceof Error ? error.message : String(error)}`;
    throw error;
  }

  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </StrictMode>,
  );
}

void start();
