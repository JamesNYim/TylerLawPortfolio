// frontend/src/App.jsx
import Header from './components/header.jsx';
import Footer from './components/footer.jsx';
import './style.css'; // optional: if you prefer importing CSS via modules instead of <link>

export default function App() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />

      <main style={{ flex: 1 }}>
        <div className="pfp">
          {/* Option A: images in /public (public/Tlawpfp.jpg) */}
        </div>
      </main>

      <Footer />
    </div>
  );
}

