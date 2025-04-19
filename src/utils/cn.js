/**
 * Utility function for conditionally joining classNames together
 * This is commonly used with Tailwind CSS for conditional class applications
 * 
 * @param  {...string} classes - Class names or conditional expressions that resolve to class names
 * @returns {string} - Joined class names
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
} 