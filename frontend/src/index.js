import React from 'react';
import ReactDOM from 'react-dom/client';
// CHANGED: added QueryClient + ErrorBoundary
import { QueryClient, QueryClientProvider, QueryCache } from '@tanstack/react-query';
import './index.css';
import App from './App';
import ErrorBoundary from './ErrorBoundary';
import reportWebVitals from './reportWebVitals';

// Global QueryClient — all API errors are logged here via QueryCache.onError
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      console.error(`[QueryCache Error] key=${JSON.stringify(query.queryKey)}`, error?.message);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // 5 minutes
      gcTime: 10 * 60 * 1000,     // 10 minutes (formerly cacheTime in v4)
      retry: false,   // no retries — 500s are backend errors, not transient
      refetchOnWindowFocus: false,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </QueryClientProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
