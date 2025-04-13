/**
 * Simple analytics module for tracking user interactions
 * In a production environment, this would typically integrate with a proper
 * analytics service like Google Analytics, Segment, Mixpanel, etc.
 */

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Base event properties to include with all events
const baseProperties = {
  appVersion: '1.0.0',
  environment: process.env.NODE_ENV || 'development'
};

/**
 * Track an event with optional properties
 * @param {string} eventName - Name of the event to track
 * @param {Object} properties - Properties to include with the event
 */
const track = (eventName, properties = {}) => {
  if (!isBrowser) return;
  
  // Combine base properties with event-specific properties
  const eventProperties = {
    ...baseProperties,
    ...properties,
    timestamp: new Date().toISOString()
  };
  
  // Log events to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Analytics] ${eventName}:`, eventProperties);
  }
  
  // In a real implementation, this would send data to an analytics service
  // Example: segment.track(eventName, eventProperties);
};

/**
 * Identify a user for analytics tracking
 * @param {string} userId - Unique identifier for the user (wallet address, FID, etc.)
 * @param {Object} traits - User traits/properties to record
 */
const identify = (userId, traits = {}) => {
  if (!isBrowser || !userId) return;
  
  // Log identity to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Analytics] Identified User:`, { userId, traits });
  }
  
  // In a real implementation, this would identify the user in the analytics service
  // Example: segment.identify(userId, traits);
};

/**
 * Track a page view
 * @param {string} pageName - Name of the page being viewed
 * @param {Object} properties - Additional properties for the page view
 */
const pageView = (pageName, properties = {}) => {
  if (!isBrowser) return;
  
  track('Page Viewed', {
    page: pageName,
    url: window.location.href,
    path: window.location.pathname,
    ...properties
  });
  
  // In a real implementation, this would track a page view in the analytics service
  // Example: segment.page(pageName, properties);
};

const analytics = {
  track,
  identify,
  pageView
};

export default analytics; 