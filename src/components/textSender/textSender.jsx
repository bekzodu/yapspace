import React, { useState } from 'react';
import './textSender.css';

const TextSender = () => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) {
      setMessages([...messages, message]);
      setMessage('');
      // Remove the message after animation completes
      setTimeout(() => {
        setMessages(prev => prev.filter(msg => msg !== message));
      }, 3000);
    }
  };

  return (
    <div className="text-sender-container">
      <div className="floating-messages">
        {messages.map((msg, index) => (
          <div key={index} className="floating-message">
            {msg}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="input-form">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message"
          className="message-input"
        />
        <button type="submit" className="send-button">
          <i className="fas fa-arrow-up"></i>
        </button>
      </form>
    </div>
  );
};

export default TextSender;
