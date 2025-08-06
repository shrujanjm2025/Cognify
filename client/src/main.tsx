import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ReactQueryDevtools } from 'react-query/devtools';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'react-hot-toast';
import { ErrorBoundary } from 'react-error-boundary';

import App from './App';
import { store, persistor } from '@store/index';
import { AuthProvider } from '@hooks/useAuth';
import { SocketProvider } from '@hooks/useSocket';
import { ThemeProvider } from '@hooks/useTheme';
import ErrorFallback from '@components/ErrorFallback';
import LoadingSpinner from '@components/LoadingSpinner';

import './index.css';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
    },
    mutations: {
      retry: 1,
    },
  },
});

// PWA registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

// Error boundary error handler
const handleError = (error: Error, errorInfo: { componentStack: string }) => {
  console.error('Application Error:', error);
  console.error('Component Stack:', errorInfo.componentStack);
  
  // You can integrate with error reporting services here
  // e.g., Sentry, LogRocket, etc.
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary 
      FallbackComponent={ErrorFallback} 
      onError={handleError}
      onReset={() => window.location.reload()}
    >
      <HelmetProvider>
        <Provider store={store}>
          <PersistGate 
            loading={<LoadingSpinner fullScreen />} 
            persistor={persistor}
          >
            <QueryClientProvider client={queryClient}>
              <BrowserRouter>
                <ThemeProvider>
                  <AuthProvider>
                    <SocketProvider>
                      <App />
                      
                      {/* Toast notifications */}
                      <Toaster
                        position="top-right"
                        toastOptions={{
                          duration: 4000,
                          style: {
                            background: '#363636',
                            color: '#fff',
                          },
                          success: {
                            duration: 3000,
                            iconTheme: {
                              primary: '#22c55e',
                              secondary: '#fff',
                            },
                          },
                          error: {
                            duration: 5000,
                            iconTheme: {
                              primary: '#ef4444',
                              secondary: '#fff',
                            },
                          },
                        }}
                      />
                      
                      {/* React Query DevTools - only in development */}
                      {process.env.NODE_ENV === 'development' && (
                        <ReactQueryDevtools initialIsOpen={false} />
                      )}
                    </SocketProvider>
                  </AuthProvider>
                </ThemeProvider>
              </BrowserRouter>
            </QueryClientProvider>
          </PersistGate>
        </Provider>
      </HelmetProvider>
    </ErrorBoundary>
  </React.StrictMode>
);