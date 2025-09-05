// src/components/Header.jsx
import { Link } from 'react-router-dom';

export default function Header() {
  return (
    <header style={{
      color: 'black',
      fontFamily: 'Oswald, serif',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0 25px',
      borderBottom: '2px solid black'
    }}>
      <h1 style={{ fontSize: '60px', margin: 0 }}>TYLER LAW</h1>
      
      <nav style={{ display: 'flex', gap: '1rem' }}>
        <Link style={{ fontSize: '36px', textDecoration: 'none', color: 'inherit' }} to="/">Home</Link>
        <Link style={{ fontSize: '36px', textDecoration: 'none', color: 'inherit' }} to="/gallery">Gallery</Link>
        <Link style={{ fontSize: '36px', textDecoration: 'none', color: 'inherit' }} to="/contact">Contact</Link>
      </nav>
    </header>
  );
}

