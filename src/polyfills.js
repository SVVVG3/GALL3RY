// Polyfill for process in browser environment
if (typeof window !== 'undefined') {
  window.process = window.process || {};
  window.process.env = window.process.env || {};
  window.process.browser = true;
  window.process.version = '';
  window.process.versions = { node: false };
  
  if (!window.process.nextTick) {
    window.process.nextTick = function(callback) {
      setTimeout(callback, 0);
    };
  }
  
  window.process.on = window.process.addListener = 
  window.process.once = window.process.off = 
  window.process.removeListener = window.process.removeAllListeners = 
  window.process.emit = function() {
    return null;
  };
}

export default {}; 