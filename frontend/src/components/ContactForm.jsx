import React, { useRef, useState } from 'react';
import emailjs from '@emailjs/browser';
import './ContactForm.css';

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

export default function ContactForm() {
  const form = useRef();
  const [status, setStatus] = useState(null);  
  const [loading, setLoading] = useState(false);

  const sendEmail = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      await emailjs.sendForm(SERVICE_ID, TEMPLATE_ID, form.current, { publicKey: PUBLIC_KEY });
      setStatus('success');
      form.current.reset(); // clear the form after sending
    } catch (err) {
      console.error('EmailJS Error:', err);
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ContactForm">
      <h1 className="ContactForm__title">Contact</h1>

      <form ref={form} onSubmit={sendEmail} className="ContactForm__form">
        <div className="formSection">
          <input required type="text" name="user_name" placeholder="name" className="inputBase" />
        </div>

        <div className="formSection">
          <input required type="email" name="user_email" placeholder="email" className="inputBase" />
        </div>

        <div className="formSection">
          <textarea required name="message" placeholder="message" className="textareaBase" />
        </div>

        <input
          type="submit"
          value={loading ? "Sending..." : "Send Message"}
          className="submitBtn"
          disabled={loading}
        />

        {status === 'success' && (
          <p className="feedback success">Message sent successfully!</p>
        )}
        {status === 'error' && (
          <p className="feedback error">Failed to send. Please try again later.</p>
        )}
      </form>
    </div>
  );
}

