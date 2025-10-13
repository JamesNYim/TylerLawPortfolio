// frontend/src/components/Footer.jsx
import { BiLogoInstagram, BiLogoFacebookSquare, BiLogoLinkedinSquare, BiLogoTiktok, BiLogoYoutube } from 'react-icons/bi';

const iconStyle = {
    fontSize: '60px',
    display: 'inline-block',
};

const linkStyle = {
    color: 'black'
};

const socialsContainerStyle = {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
    margin: '8px'

};
export default function Footer() {
  return (
    <footer style={{
      color: 'black',
      fontFamily: 'Playfair Display, serif',
      width: 'auto',
      borderTop: '2px solid black',
      padding: '10px 25px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <h1 style={{ fontSize: 60, margin: 10 }}>TYLER LAW</h1>
      <div className="socials" style={socialsContainerStyle}>
          <a href="#" style={linkStyle}><BiLogoInstagram style={iconStyle} /></a>
          <a href="#" style={linkStyle}><BiLogoFacebookSquare style={iconStyle} /></a>
          <a href="#" style={linkStyle}><BiLogoLinkedinSquare style={iconStyle} /></a>
          <a href="#" style={linkStyle}><BiLogoTiktok style={iconStyle} /></a>
          <a href="#" style={linkStyle}><BiLogoYoutube style={iconStyle} /></a>
      </div>
    </footer>
  );
}

