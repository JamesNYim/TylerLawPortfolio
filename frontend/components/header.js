class Header extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <style>
                header {
                    color: black;
                    font-family: 'Oswald', serif;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    height: auto;
                    padding: 0px 25px;
                    border-bottom: 2px solid black; 
                }
                h1 {
                    display: inline;
                    font-size: 60px;
                    margin: 0px;
                }
                nav {
                    display: flex;
                }

                ul li {
                    display: inline-flex;
                    padding: 10px;
                }
                ul li a {
                    color: inherit;
                    font-size: 36px;
                    text-decoration: none;
                }
            </style>
            <header>
                <h1> TYLER LAW </h1>
                <nav>
                    <ul>
                        <li><a href="Headshot.html">Headshot/Resume</a></li>
                        <li><a href="gallery.html">Gallery</a></li>
                        <li><a href="contact.html">Contact</a></li>
                    </ul>
                </nav>
            </header>
        `;
    }
}

customElements.define('header-component', Header);

