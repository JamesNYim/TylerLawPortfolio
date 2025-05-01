class Footer extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <style>
                footer {
                    color: black;
                    font-family: 'Oswald', serif;
                    bottom: 0;
                    left: 0;
                    width: 100%;
                    border-top: 2px solid black;
                }
                h1 {
                    font-size: 80px;
                    margin: 10px;
                }
            </style>
            <footer>
                <h1> TYLER LAW </h1>
            </footer>
        `;
    }
}

customElements.define('footer-component', Footer);

