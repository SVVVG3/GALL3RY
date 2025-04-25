import React from 'react';
import { useStyle } from '../contexts/StyleContext';

/**
 * StyleToggle component
 * A simple UI toggle for switching between unified and legacy CSS
 */
const StyleToggle = () => {
  const { useUnifiedCSS, toggleUnifiedCSS } = useStyle();

  return (
    <div className="style-toggle-container">
      <label className="style-toggle-switch">
        <input
          type="checkbox"
          checked={useUnifiedCSS}
          onChange={toggleUnifiedCSS}
        />
        <span className="style-toggle-slider"></span>
      </label>
      <span className="style-toggle-label">
        {useUnifiedCSS ? 'Unified CSS (New)' : 'Legacy CSS'}
      </span>
      <style jsx>{`
        .style-toggle-container {
          display: flex;
          align-items: center;
          margin: 10px 0;
          padding: 5px 10px;
          background-color: #f5f5f5;
          border-radius: 4px;
        }
        
        .style-toggle-switch {
          position: relative;
          display: inline-block;
          width: 40px;
          height: 20px;
          margin-right: 10px;
        }
        
        .style-toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        
        .style-toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ccc;
          transition: .4s;
          border-radius: 20px;
        }
        
        .style-toggle-slider:before {
          position: absolute;
          content: "";
          height: 16px;
          width: 16px;
          left: 2px;
          bottom: 2px;
          background-color: white;
          transition: .4s;
          border-radius: 50%;
        }
        
        input:checked + .style-toggle-slider {
          background-color: #2196F3;
        }
        
        input:checked + .style-toggle-slider:before {
          transform: translateX(20px);
        }
        
        .style-toggle-label {
          font-size: 14px;
          color: #333;
        }
      `}</style>
    </div>
  );
};

export default StyleToggle; 