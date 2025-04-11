import React from 'react';

const Spinner = ({ size = 'md', color = 'purple-500' }) => {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-3',
  };

  const spinnerSize = sizeClasses[size] || sizeClasses.md;

  return (
    <div className={`animate-spin rounded-full ${spinnerSize} border-t-${color} border-b-${color} border-l-transparent border-r-transparent`}></div>
  );
};

export default Spinner; 