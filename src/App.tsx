import React from 'react';
import { useStore } from './hooks/useStore';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Sessions from './components/Sessions';
import PromptLab from './components/PromptLab';
import DirectInteraction from './components/DirectInteraction';
import PromptLibrary from './components/PromptLibrary';
import ExploitChain from './components/ExploitChain';
import Reports from './components/Reports';

export default function App() {
  const store = useStore();

  const page = (() => {
    switch (store.activeView) {
      case 'dashboard': return <Dashboard store={store} />;
      case 'sessions':  return <Sessions store={store} />;
      case 'promptlab': return <PromptLab store={store} />;
      case 'interact':  return <DirectInteraction store={store} />;
      case 'library':   return <PromptLibrary />;
      case 'chain':     return <ExploitChain store={store} />;
      case 'reports':   return <Reports store={store} />;
      default:          return <Dashboard store={store} />;
    }
  })();

  return (
    <Layout store={store}>
      {page}
    </Layout>
  );
}
