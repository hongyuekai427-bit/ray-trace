import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

try {
  ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
} catch (error) {
  console.error('Failed to mount React app:', error);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column; gap: 1rem; padding: 2rem; text-align: center;">
        <h1 style="font-size: 1.5rem; color: #ef4444;">Application Error</h1>
        <p style="color: rgba(255,255,255,0.6);">Failed to initialize the application.</p>
        <p style="color: rgba(255,255,255,0.4); font-size: 0.875rem;">${error instanceof Error ? error.message : 'Unknown error'}</p>
        <button onclick="location.reload()" style="padding: 0.5rem 1rem; background: #3b82f6; color: white; border: none; border-radius: 0.25rem; cursor: pointer;">Reload</button>
      </div>
    `;
  }
}
