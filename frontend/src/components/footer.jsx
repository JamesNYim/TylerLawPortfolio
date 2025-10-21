// src/components/Footer.jsx
import { BiLogoInstagram, BiLogoFacebookSquare, BiLogoLinkedinSquare, BiLogoTiktok, BiLogoYoutube } from 'react-icons/bi';
import './footer.css';

export default function Footer() {
  return (
    <footer>
      <h1>TYLER LAW</h1>
      <div className="socials">
        <a href="#"><BiLogoInstagram /></a>
        <a href="#"><BiLogoFacebookSquare /></a>
        <a href="#"><BiLogoLinkedinSquare /></a>
        <a href="#"><BiLogoTiktok /></a>
        <a href="#"><BiLogoYoutube /></a>
      </div>
    </footer>
  );
}

