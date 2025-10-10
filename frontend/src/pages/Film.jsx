import SectionTabPage from "./SectionTabPage.jsx";
import Header from '../components/header.jsx';
import Footer from '../components/footer.jsx';

export default function Film() {
    return (
      <div className="Film">
        <Header />
        <SectionTabPage title="Film" tabs={["acting", "production"]}showTabs={true} />
        <Footer />
      </div>
  );
}

