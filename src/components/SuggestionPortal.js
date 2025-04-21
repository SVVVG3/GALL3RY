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
    if (!portalRef.current) {
      const div = document.createElement('div');
      div.id = 'suggestion-portal';
      div.style.position = 'fixed';
      div.style.zIndex = '9999999';
      div.style.pointerEvents = 'auto';
      document.body.appendChild(div);
      portalRef.current = div;
    }
    
    return () => {
      if (portalRef.current) {
        document.body.removeChild(portalRef.current);
        portalRef.current = null;
      }
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