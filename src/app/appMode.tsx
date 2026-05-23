import React, { createContext, useContext } from 'react';

export type AppMode = 'user' | 'admin';

export interface AppModeValue {
  mode: AppMode;
  basePath: string;
}

const AppModeContext = createContext<AppModeValue | null>(null);

export function AppModeProvider(props: { mode: AppMode; children: React.ReactNode }) {
  const basePath = props.mode === 'admin' ? '/admin' : '/app';
  return (
    <AppModeContext.Provider value={{ mode: props.mode, basePath }}>
      {props.children}
    </AppModeContext.Provider>
  );
}

export function useAppMode(): AppModeValue {
  const ctx = useContext(AppModeContext);
  if (!ctx) throw new Error('useAppMode must be used within AppModeProvider');
  return ctx;
}
