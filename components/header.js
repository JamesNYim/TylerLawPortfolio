class Header extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.innerHTML = `
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@200..700&display=swap');
                header {
                    color: black;
                    font-family: 'Oswald', serif;
                    margin: 10px 20px;
                    position: relative
                }
                h1 {
                    display: inline;
                    font-size: 48px;
                }
                nav {
                    display: inline-flex;
                    flex-direction: column;
                    position: absolute;
                    right: 0;
                    overflow: hidden;
                }

                ul li {
                    display: inline-flex;
                    padding: 10px;
                }
                ul li a {
                    color: inherit;
                    font-size: 24px;
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

