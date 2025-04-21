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
      
      // Add click listener directly to the portal for selection events
      div.addEventListener('click', (e) => {
        // Check if clicked element is a suggestion item
        if (e.target.closest('.username-suggestion-item')) {
          console.log('Selection made within portal, forcing cleanup');
          
          // Use a small timeout to allow the click event to complete
          setTimeout(() => {
            try {
              // Force unmount and removal
              if (document.body.contains(div)) {
                ReactDOM.unmountComponentAtNode(div);
                document.body.removeChild(div);
                portalRef.current = null;
              }
            } catch (err) {
              console.error('Error in portal cleanup:', err);
            }
          }, 10);
        }
      });
    }
    
    // Cleanup function to remove the portal when component unmounts
    return () => {
      if (portalRef.current) {
        // Make sure to cleanup any existing portal content
        try {
          ReactDOM.unmountComponentAtNode(portalRef.current);
        } catch (err) {
          console.error('Error unmounting portal content:', err);
        }
        
        // Remove the DOM element
        try {
          if (document.body.contains(portalRef.current)) {
            document.body.removeChild(portalRef.current);
          }
        } catch (err) {
          console.error('Error removing portal from DOM:', err);
        }
        
        portalRef.current = null;
      }
      
      // Also clean up any other suggestion portals that might exist (safety check)
      const existingPortals = document.querySelectorAll('#suggestion-portal');
      existingPortals.forEach(portal => {
        try {
          ReactDOM.unmountComponentAtNode(portal);
          if (document.body.contains(portal)) {
            document.body.removeChild(portal);
          }
        } catch (err) {
          console.error('Error cleaning up extra portal:', err);
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
          try {
            ReactDOM.unmountComponentAtNode(portalRef.current);
            if (document.body.contains(portalRef.current)) {
              document.body.removeChild(portalRef.current);
              portalRef.current = null;
            }
          } catch (err) {
            console.error('Error in click outside handler:', err);
          }
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