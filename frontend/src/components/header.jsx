// src/components/Header.jsx

import './header.css';
import { Link } from 'react-router-dom';
import { useState } from 'react';

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="header">
      <h1 className="title">TYLER LAW</h1>

      <button
        className="menuButton"
        aria-expanded={open}
        aria-controls="site-nav"
        onClick={() => setOpen(o => !o)}
      >
        <span className="sr-only">Toggle menu</span>
        <svg className="menuIcon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
        </svg>
      </button>
      <nav id="site-nav" className={`nav ${open ? 'nav--open' : ''}`}>
        <Link className="navLink" to="/" onClick={() => setOpen(false)}>Home</Link>
        <Link className="navLink" to="/film" onClick={() => setOpen(false)}>Film</Link>
        <Link className="navLink" to="/dance" onClick={() => setOpen(false)}>Dance</Link>
        <Link className="navLink" to="/modeling" onClick={() => setOpen(false)}>Modeling</Link>
        <Link className="navLink" to="/contact" onClick={() => setOpen(false)}>Contact</Link>
      </nav>
    </header>
  );
}


