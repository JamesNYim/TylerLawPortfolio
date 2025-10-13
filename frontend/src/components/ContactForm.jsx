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
        <form ref={form} onSubmit={sendEmail}>
            <label>Name</label>
            <input type="text" name="user_name" />

            <label>Email</label>
            <input type="email" name="user_email" />
        
            <label>Message</label>
            <textarea name="message" />

            <input type="submit" value="Send" />
        </form>
    );
}
