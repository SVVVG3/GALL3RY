import React, { useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';

/**
 * Component that renders a suggestions dropdown outside the normal DOM hierarchy
 * to avoid CSS conflicts
 */
const SuggestionPortal = ({ children, inputRect }) => {
  const portalRef = useRef(null);
  const portalContainerRef = useRef(null);
  
  // Function to clean up a single portal
  const cleanupPortal = () => {
    try {
      if (portalContainerRef.current) {
        // Try to unmount the React component within the portal
        try {
          ReactDOM.unmountComponentAtNode(portalContainerRef.current);
        } catch (err) {
          console.log('Error unmounting portal component:', err);
        }
        
        // Remove the portal from DOM
        if (document.body.contains(portalContainerRef.current)) {
          document.body.removeChild(portalContainerRef.current);
          console.log('Portal container removed during cleanup');
        }
        
        // Clear references
        portalContainerRef.current = null;
        portalRef.current = null;
      }
    } catch (err) {
      console.error('Error during portal cleanup:', err);
    }
  };
  
  // Function to clean up ALL portals - used as a fallback
  const cleanupAllPortals = () => {
    try {
      const portalElements = document.querySelectorAll('#suggestion-portal');
      console.log(`Fallback cleanup: found ${portalElements.length} suggestion portals`);
      
      portalElements.forEach(el => {
        try {
          // Try to unmount React components first
          ReactDOM.unmountComponentAtNode(el);
        } catch (err) {
          console.log('Error unmounting portal during fallback cleanup:', err);
        }
        
        // Remove from DOM directly
        if (document.body.contains(el)) {
          document.body.removeChild(el);
          console.log('Portal removed during fallback cleanup');
        }
      });
      
      // Clear references regardless
      portalContainerRef.current = null;
      portalRef.current = null;
    } catch (err) {
      console.error('Error during fallback portal cleanup:', err);
    }
  };
  
  useEffect(() => {
    // Unique ID for the portal based on timestamp
    const portalId = `suggestion-portal`;
    
    // Clean up any existing portals before creating a new one
    cleanupAllPortals();
    
    // Create a single portal container for this component instance
    if (!portalContainerRef.current && inputRect) {
      // Create container
      const container = document.createElement('div');
      container.id = portalId;
      container.style.position = 'absolute';
      container.style.zIndex = '999999';
      container.style.pointerEvents = 'auto';
      container.style.transition = 'opacity 150ms ease-in-out';
      container.style.opacity = '0';
      container.dataset.timestamp = Date.now();
      
      // Store ref and append to body
      portalContainerRef.current = container;
      document.body.appendChild(container);
      
      // Trigger animation after a small delay
      setTimeout(() => {
        if (container && document.body.contains(container)) {
          container.style.opacity = '1';
        }
      }, 10);
    }
    
    // Position the portal according to input rectangle
    if (portalContainerRef.current && inputRect) {
      // Position directly under the input
      portalContainerRef.current.style.top = `${inputRect.bottom + 2}px`;
      portalContainerRef.current.style.left = `${inputRect.left}px`;
      portalContainerRef.current.style.width = `${inputRect.width}px`;
      portalContainerRef.current.style.display = 'block';
    }
    
    // Set up portal reference to use in the return statement
    portalRef.current = portalContainerRef.current;
    
    // Add a click event listener to the document to close the portal when clicking outside
    const handleClickOutside = (event) => {
      // Only process if we have an active portal
      if (!portalContainerRef.current) return;
      
      // Check if click is inside the portal
      if (portalContainerRef.current && !portalContainerRef.current.contains(event.target)) {
        // Click is outside, clean up
        cleanupPortal();
      }
    };
    
    // Add document-wide click handler
    document.addEventListener('click', handleClickOutside, true);
    
    // Cleanup function
    return () => {
      // Remove event listener first
      document.removeEventListener('click', handleClickOutside, true);
      
      // Then clean up portal
      cleanupPortal();
      
      // As a fallback, also clean up any remaining portals with the same ID
      setTimeout(cleanupAllPortals, 10);
    };
  }, [inputRect]); // Re-run when inputRect changes
  
  // Run cleanup when component unmounts
  useEffect(() => {
    return () => {
      cleanupPortal();
      setTimeout(cleanupAllPortals, 10);
    };
  }, []);
  
  // Return null if not set, otherwise create portal with children
  if (!portalRef.current || !inputRect) {
    return null;
  }
  
  return ReactDOM.createPortal(
    <div 
      className="suggestion-dropdown" 
      data-testid="suggestion-dropdown"
      style={{
        backgroundColor: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        maxHeight: "300px",
        overflowY: "auto",
        boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
        width: "100%",
        zIndex: 999999
      }}
    >
      {children}
    </div>,
    portalRef.current
  );
};

export default SuggestionPortal; 