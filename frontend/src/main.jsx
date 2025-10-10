// frontend/src/main.jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Gallery from './pages/Gallery.jsx'; // create this if you haven't
import Film from './pages/Film.jsx';
import Dance from './pages/Dance.jsx';
import Modeling from './pages/Modeling.jsx';
import Home from './pages/Home.jsx';

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/gallery" element={<Gallery />} />
      <Route path="/film" element={<Film />} />
      <Route path="/dance" element={<Dance />} />
      <Route path="/modeling" element={<Modeling />} />
      {/* Add more routes here */}
    </Routes>
  </BrowserRouter>
);

