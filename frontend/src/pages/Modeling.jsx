import SectionTabPage from "./SectionTabPage.jsx";
import Header from '../components/header.jsx';
import Footer from '../components/footer.jsx';

export default function Modeling() {
  // single section; hide tabs for a cleaner page
  return (
      <div className="Modeling">
        <Header />
        <SectionTabPage title="Modeling" tabs={["modeling"]} showTabs={false} />
        <Footer />
      </div>
  );
}

