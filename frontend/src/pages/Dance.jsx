import SectionTabPage from "./SectionTabPage.jsx";
import Header from '../components/header.jsx';
import Footer from '../components/footer.jsx';

export default function Dance() {
    return (
          <div className="Dance">
            <Header />
            <SectionTabPage title="Dance" tabs={["dancer", "choreography"]} showTabs={true} />
            <Footer />
          </div>
      );
}

