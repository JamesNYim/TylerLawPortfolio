import React, { useRef } from 'react';
import emailjs from '@emailjs/browser';

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

console.log("EmailJS env:", {
  SERVICE_ID: SERVICE_ID,
  TEMPLATE_ID:TEMPLATE_ID,
  PUBLIC_KEY: PUBLIC_KEY,
});

export default function ContactForm() {
    const form = useRef();

    const sendEmail = (e) => {
        e.preventDefault();

        emailjs.sendForm(
            SERVICE_ID,
            TEMPLATE_ID,
            form.current,
            {publicKey: PUBLIC_KEY },
        )
        .then(
            () => { console.log("Successfully sent email\n"); },
            (e) => { console.log("Error sending email...\n", e.text); },
        );
    };

    
    return (
        <div className="ContactForm" style={{
            marginTop: '25vh',
            height: '100vh',
        }}>
            <style> 
            {`
                input::placeholder,
                textarea::placeholder {
                    color: grey;
                    font-weight: lighter;
                    font-family: Playfair Display;
                },
            `}
            </style>
            <h1 style={{fontFamily: 'Playfair Display', fontWeight: 'lighter', color: 'grey', textAlign: 'center'}}>Contact</h1>
            <form ref={form} onSubmit={sendEmail} style={{
                display: 'flex',
                justifyContent: 'center',
                flexDirection: 'column',
            }}>
                
                <div className="Name" style ={formSectionStyle}>
                    <input required type="text" name="user_name" placeholder="name" style={{
                        ...textareaStyle, 
                        height: '2em',
                        borderBottom: '0px'
                    }}/>
                </div>

                <div className="Email" style ={formSectionStyle}>
                    <input required type="email" name="user_email" placeholder="email" style={{
                        ...textareaStyle, 
                        height: '2em',
                        borderBottom: '0px'
                    }}/>
                </div>
            
                <div className="Message" style ={formSectionStyle}>
                    <textarea required name="message" placeholder="message" style={{
                        ...textareaStyle, 
                        height: '16em'
                    }}/>
                </div>

                <input 
                    type="submit" 
                    value="Send Message" 
                    style ={{
                        fontSize: 'inherit',
                        fontFamily: 'inherit',
                        fontWeight: 'lighter',
                        width: '25em',
                        height: '3em',
                        margin: '24px auto',
                        cursor: 'pointer',
                        backgroundColor: 'transparent',
                        border: '2px solid grey',
                        color: 'grey',
                    }}
                    onMouseOver= {(e) => {
                        e.target.style.fontStyle='italic';
                    }}
                    onMouseOut= {(e) => {
                        e.target.style.fontStyle='normal';
                    }}
                />
            </form>
        </div>
    );
}

const formSectionStyle = { 
    width: '50%', 
    margin: '0 auto', 
    display: 'flex', 
    flexDirection: 'column', 
    justifyContent: 'center',
    fontFamily: 'Playfair Display',
    fontSize: '24px',
};

const textareaStyle = {                         
    borderRadius: '0px',
    border: "2px solid #ccc",
    fontFamily: 'inherit',
    fontSize: 'inherit',
    color: 'grey',
};
