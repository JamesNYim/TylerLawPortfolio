import SectionTabPage from "./SectionTabPage.jsx";
import Header from '../components/header.jsx';
import Footer from '../components/footer.jsx';

import "../styles/Home.css";

export default function Home() {
  // single section; hide tabs for a cleaner page
  return (
      <div className="Home">
        <Header />
        <div className="aboutMe">
            <div className="bio">
                <p> 
                    Tyler Law works in the film/TV, dance, and modeling industries with experience in acting (SAG-E), production work, dancing, choreographing, photoshoots, and runway. 
                    Currently based in Los Angeles, she can also work as a Bay Area (SF) and Atlanta local. 
                    She received her B.A. in Dance and minor in Film, TV, and Digital Media from UCLA.
                </p>
            </div>
            <SectionTabPage id="home-gallery" title="" tabs={["pfp"]} showTabs={false} />
        </div>
        <Footer />
      </div>
  );
}
