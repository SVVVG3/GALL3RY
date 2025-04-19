import React from 'react';

/**
 * Simple Avatar component for displaying user profile images
 * 
 * @param {Object} props - Component props
 * @param {string} props.src - Image source URL
 * @param {string} props.alt - Alternative text for the image
 * @param {string} props.size - Size of the avatar (sm, md, lg)
 * @param {string} props.className - Additional CSS classes
 * @returns {JSX.Element} - The rendered avatar component
 */
const Avatar = ({ src, alt, size = "md", className = "", ...props }) => {
  // Define size dimensions
  const sizes = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };

  // Use a placeholder image if no src is provided
  const imgSrc = src || "/assets/placeholder-avatar.png";
  
  // Apply size class and additional classes
  const sizeClass = sizes[size] || sizes.md;
  const avatarClass = `rounded-full overflow-hidden ${sizeClass} ${className}`;

  return (
    <div className={avatarClass} {...props}>
      <img 
        src={imgSrc}
        alt={alt || "User avatar"}
        className="h-full w-full object-cover"
        onError={(e) => {
          // Set fallback if image fails to load
          e.target.onerror = null;
          e.target.src = "/assets/placeholder-avatar.png";
        }}
      />
    </div>
  );
};

export default Avatar; 