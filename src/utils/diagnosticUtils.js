// Diagnostic logging utilities for mobile app debugging

import { isMiniAppEnvironment } from './miniAppUtils';

/**
 * Constants for log levels
 */
export const LOG_LEVEL = {
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  DEBUG: 'debug'
};

/**
 * Utility for logging diagnostic information and sending it to a server
 */

// Maximum number of logs to keep in memory
const MAX_LOGS = 500;

/**
 * A simple in-memory logger that stores logs and allows subscribing to updates
 */
class Logger {
  constructor() {
    this.logs = [];
    this.listeners = [];
    this.MAX_LOGS = 1000;
    
    // Intercept console methods
    this.originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug
    };
    
    // Override console methods to capture logs
    console.log = (...args) => {
      this.originalConsole.log(...args);
      this.addLog('log', ...args);
    };
    
    console.info = (...args) => {
      this.originalConsole.info(...args);
      this.addLog('info', ...args);
    };
    
    console.warn = (...args) => {
      this.originalConsole.warn(...args);
      this.addLog('warn', ...args);
    };
    
    console.error = (...args) => {
      this.originalConsole.error(...args);
      this.addLog('error', ...args);
    };
    
    console.debug = (...args) => {
      this.originalConsole.debug(...args);
      this.addLog('debug', ...args);
    };
    
    // Listen for our custom event
    if (typeof window !== 'undefined') {
      window.addEventListener('miniAppAuthenticated', (event) => {
        this.info('Mini App Authentication Event', event.detail);
      });
    }
  }
  
  /**
   * Add a log entry
   * @param {string} level - The log level (log, info, warn, error, debug)
   * @param {...any} args - The arguments passed to the console method
   */
  addLog(level, ...args) {
    const timestamp = new Date();
    const stringifiedArgs = args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    });
    
    const log = {
      id: Date.now() + Math.random().toString(36).substr(2, 5),
      timestamp,
      level,
      message: stringifiedArgs.join(' '),
      rawArgs: args
    };
    
    this.logs.push(log);
    
    // Keep logs under the maximum size
    if (this.logs.length > this.MAX_LOGS) {
      this.logs = this.logs.slice(-this.MAX_LOGS);
    }
    
    // Notify listeners
    this.notifyListeners();
  }
  
  /**
   * Add a log entry with level 'log'
   * @param {string} message - The log message
   * @param {object} [data] - Additional data to log
   */
  log(message, data) {
    this.originalConsole.log(message, data);
    this.addLog('log', message, data);
  }
  
  /**
   * Add a log entry with level 'info'
   * @param {string} message - The log message
   * @param {object} [data] - Additional data to log
   */
  info(message, data) {
    this.originalConsole.info(message, data);
    this.addLog('info', message, data);
  }
  
  /**
   * Add a log entry with level 'warn'
   * @param {string} message - The log message
   * @param {object} [data] - Additional data to log
   */
  warn(message, data) {
    this.originalConsole.warn(message, data);
    this.addLog('warn', message, data);
  }
  
  /**
   * Add a log entry with level 'error'
   * @param {string} message - The log message
   * @param {object} [data] - Additional data to log
   */
  error(message, data) {
    this.originalConsole.error(message, data);
    this.addLog('error', message, data);
  }
  
  /**
   * Add a log entry with level 'debug'
   * @param {string} message - The log message
   * @param {object} [data] - Additional data to log
   */
  debug(message, data) {
    this.originalConsole.debug(message, data);
    this.addLog('debug', message, data);
  }
  
  /**
   * Get all logs
   * @returns {Array} - All logs
   */
  getLogs() {
    return [...this.logs];
  }
  
  /**
   * Get logs filtered by level
   * @param {string|Array} levels - The log level(s) to filter by
   * @returns {Array} - Filtered logs
   */
  getLogsByLevel(levels) {
    const levelArray = Array.isArray(levels) ? levels : [levels];
    return this.logs.filter(log => levelArray.includes(log.level));
  }
  
  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = [];
    this.notifyListeners();
  }
  
  /**
   * Subscribe to log updates
   * @param {Function} listener - The listener function
   * @returns {Function} - Unsubscribe function
   */
  subscribe(listener) {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
  
  /**
   * Notify all listeners of log updates
   */
  notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.logs);
      } catch (e) {
        this.originalConsole.error('Error notifying listener', e);
      }
    });
  }
  
  /**
   * Get the SDK status
   * @returns {Object} - The SDK status
   */
  getSdkStatus() {
    if (typeof window === 'undefined') {
      return { available: false, reason: 'Not in browser environment' };
    }
    
    const status = {
      available: !!window.sdk,
      isMiniApp: false,
      context: null,
      userInfo: null
    };
    
    if (status.available) {
      status.version = window.sdk.version;
      status.hasMethods = {
        getContext: !!window.sdk.getContext,
        signIn: !!window.sdk.signIn
      };
      
      // Check if we're in a mini app
      if (
        window.navigator && 
        window.navigator.userAgent && 
        (window.navigator.userAgent.includes('Warpcast') || 
         window.navigator.userAgent.includes('Farcaster'))
      ) {
        status.isMiniApp = true;
      }
      
      // Try to get context if available
      if (window.sdk.getContext && typeof window.sdk.getContext === 'function') {
        try {
          const context = window.sdk.getContext();
          status.context = context;
        } catch (e) {
          status.contextError = e.message;
        }
      } else if (window.sdk.context) {
        status.context = window.sdk.context;
      }
      
      // Check local storage for user info
      try {
        const storedUserInfo = localStorage.getItem('miniAppUserInfo');
        if (storedUserInfo) {
          status.userInfo = JSON.parse(storedUserInfo);
        }
      } catch (e) {
        status.userInfoError = e.message;
      }
    }
    
    return status;
  }
}

// Create singleton instance
export const DiagnosticLogger = new Logger();

/**
 * Hook to use for diagnostic logging in components
 */
export const createDiagnosticTracker = (componentName) => {
  return {
    info: (message, data = {}) => {
      return DiagnosticLogger.info(`[${componentName}] ${message}`, data);
    },
    warn: (message, data = {}) => {
      return DiagnosticLogger.warn(`[${componentName}] ${message}`, data);
    },
    error: (message, data = {}) => {
      return DiagnosticLogger.error(`[${componentName}] ${message}`, data);
    },
    debug: (message, data = {}) => {
      return DiagnosticLogger.debug(`[${componentName}] ${message}`, data);
    }
  };
};

// Initialize logger on import
DiagnosticLogger.init();

// Export component to toggle diagnostic panel
export const toggleDiagnosticPanel = () => {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('toggle-diagnostic-panel');
    window.dispatchEvent(event);
  }
};

export default DiagnosticLogger; 