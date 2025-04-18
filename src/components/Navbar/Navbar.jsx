import React from 'react';
import { Link } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-logo">
          <span>YapSpace</span>
        </div>
        <ul className="navbar-menu">
          <li className="navbar-item">
            <Link to="/" className="navbar-link">
              <i className="fas fa-home"></i>
              <span>Home</span>
            </Link>
          </li>
          <li className="navbar-item">
            <Link to="/chat" className="navbar-link">
              <i className="fas fa-comments"></i>
              <span>Chat</span>
            </Link>
          </li>
          <li className="navbar-item">
            <Link to="/settings" className="navbar-link">
              <i className="fas fa-cog"></i>
              <span>Settings</span>
            </Link>
          </li>
          <li className="navbar-item">
            <Link to="/profile" className="navbar-link">
              <i className="fas fa-user"></i>
              <span>Profile</span>
            </Link>
          </li>
          <li className="navbar-item">
            <Link to="/video" className="navbar-link">
              <i className="fas fa-video"></i>
              <span>Video Chat</span>
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;
