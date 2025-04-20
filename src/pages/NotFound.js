import React from 'react';
import { Link } from 'react-router-dom';

/**
 * NotFound (404) page component
 */
const NotFound = () => {
  return (
    <div className="not-found-container">
      <h1>404 - Page Not Found</h1>
      <p>The page you're looking for doesn't exist or has been moved.</p>
      <div className="actions">
        <Link to="/" className="home-link">
          Go to Home Page
        </Link>
      </div>
    </div>
  );
};

export default NotFound; 