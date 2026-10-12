import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import './workbench.css';
import './workbench-features.css';
import './board-polish.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
