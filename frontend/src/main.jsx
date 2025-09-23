// frontend/src/main.jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.jsx';
import Gallery from './pages/Gallery.jsx'; // create this if you haven't
import Film from './pages/Film.jsx';
import Dance from './pages/Dance.jsx';
import Modeling from './pages/Modeling.jsx';

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/gallery" element={<Gallery />} />
      <Route path="/film" element={<Film />} />
      <Route path="/dance" element={<Dance />} />
      <Route path="/modeling" element={<Modeling />} />
      {/* Add more routes here */}
    </Routes>
  </BrowserRouter>
);

