import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

/**
 * A portal component to render suggestions dropdown outside the normal DOM hierarchy
 * to avoid any CSS conflicts or visibility issues
 */
const SuggestionPortal = ({ children, inputRect }) => {
  const portalRef = useRef(null);
  
  // Create a portal container if it doesn't exist
  useEffect(() => {
    // Create the portal element if it doesn't exist
    if (!portalRef.current) {
      const div = document.createElement('div');
      div.id = 'suggestion-portal';
      div.style.position = 'fixed';
      div.style.zIndex = '9999999';
      div.style.pointerEvents = 'auto';
      document.body.appendChild(div);
      portalRef.current = div;
    }
    
    // Cleanup function to remove the portal when component unmounts
    return () => {
      if (portalRef.current) {
        // Make sure to cleanup any existing portal content
        ReactDOM.unmountComponentAtNode(portalRef.current);
        
        // Remove the DOM element
        if (document.body.contains(portalRef.current)) {
          document.body.removeChild(portalRef.current);
        }
        portalRef.current = null;
      }
      
      // Also clean up any other suggestion portals that might exist (safety check)
      const existingPortals = document.querySelectorAll('#suggestion-portal');
      existingPortals.forEach(portal => {
        if (document.body.contains(portal)) {
          document.body.removeChild(portal);
        }
      });
    };
  }, []);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // If portal exists and click is outside portal, unmount it
      if (portalRef.current && !portalRef.current.contains(event.target)) {
        // Only if the click isn't on an element with searchInput class
        const isSearchInput = event.target.classList.contains('search-input');
        if (!isSearchInput) {
          ReactDOM.unmountComponentAtNode(portalRef.current);
        }
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Position the portal based on input position
  useEffect(() => {
    if (portalRef.current && inputRect) {
      portalRef.current.style.top = `${inputRect.bottom}px`;
      portalRef.current.style.left = `${inputRect.left}px`;
      portalRef.current.style.width = `${inputRect.width}px`;
    }
  }, [inputRect]);
  
  if (!portalRef.current) return null;
  
  return ReactDOM.createPortal(children, portalRef.current);
};

export default SuggestionPortal; 