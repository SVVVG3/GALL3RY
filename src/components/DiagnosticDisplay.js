import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { DiagnosticLogger } from '../utils/diagnosticUtils';

const DiagnosticContainer = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: rgba(0, 0, 0, 0.85);
  color: #00ff00;
  font-family: monospace;
  font-size: 12px;
  max-height: 50vh;
  overflow-y: auto;
  z-index: 9999;
  padding: 8px;
  border-top: 1px solid #666;
`;

const LogEntry = styled.div`
  margin-bottom: 4px;
  padding: 2px 0;
  border-bottom: 1px solid #333;
  display: flex;
`;

const Timestamp = styled.span`
  color: #aaa;
  margin-right: 8px;
  flex-shrink: 0;
`;

const LogType = styled.span`
  margin-right: 8px;
  flex-shrink: 0;
  color: ${props => {
    switch (props.type) {
      case 'error': return '#ff5555';
      case 'warn': return '#ffaa00';
      case 'info': return '#55aaff';
      case 'debug': return '#55ff55';
      default: return '#ffffff';
    }
  }};
`;

const Message = styled.span`
  word-break: break-word;
  flex-grow: 1;
`;

const Controls = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  margin-bottom: 8px;
  border-bottom: 1px solid #666;
`;

const Button = styled.button`
  background-color: #333;
  color: white;
  border: 1px solid #666;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  margin-right: 8px;
  
  &:hover {
    background-color: #444;
  }
`;

const StatusInfo = styled.div`
  padding: 4px 0;
  color: #aaa;
  font-size: 11px;
`;

/**
 * Component that displays diagnostic information for debugging
 */
const DiagnosticDisplay = ({ initiallyVisible = false }) => {
  const [visible, setVisible] = useState(initiallyVisible);
  const [logs, setLogs] = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = React.useRef(null);

  useEffect(() => {
    // Function to update logs from the logger
    const updateLogs = () => {
      setLogs([...DiagnosticLogger.getLogs()]);
    };

    // Subscribe to log updates
    const unsubscribe = DiagnosticLogger.subscribe(updateLogs);
    
    // Initialize with current logs
    updateLogs();

    // Add keyboard shortcut to toggle visibility (Shift+Ctrl+D)
    const handleKeyDown = (e) => {
      if (e.shiftKey && e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        setVisible(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unsubscribe();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && containerRef.current && visible) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll, visible]);

  if (!visible) {
    return (
      <div style={{ position: 'fixed', bottom: 0, right: 0, padding: '4px', zIndex: 9999 }}>
        <Button onClick={() => setVisible(true)}>Show Logs ({logs.length})</Button>
      </div>
    );
  }

  const handleClear = () => {
    DiagnosticLogger.clearLogs();
    setLogs([]);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}.${date.getMilliseconds().toString().padStart(3, '0')}`;
  };

  return (
    <DiagnosticContainer ref={containerRef}>
      <Controls>
        <div>
          <Button onClick={() => setVisible(false)}>Hide</Button>
          <Button onClick={handleClear}>Clear</Button>
          <Button onClick={() => setAutoScroll(!autoScroll)}>
            {autoScroll ? 'Disable Auto-scroll' : 'Enable Auto-scroll'}
          </Button>
        </div>
        <StatusInfo>
          {logs.length} logs | SDK: {window.sdk ? 'Available' : 'Not Available'}
        </StatusInfo>
      </Controls>
      
      {logs.map((log, index) => (
        <LogEntry key={index}>
          <Timestamp>{formatTime(log.timestamp)}</Timestamp>
          <LogType type={log.type}>{log.type.toUpperCase()}</LogType>
          <Message>
            {log.message}
            {log.data && Object.keys(log.data).length > 0 && (
              <pre style={{ fontSize: '11px', color: '#aaa', margin: '2px 0 0 0' }}>
                {JSON.stringify(log.data, null, 2)}
              </pre>
            )}
          </Message>
        </LogEntry>
      ))}
      
      {logs.length === 0 && (
        <div style={{ padding: '8px 0', color: '#aaa' }}>No logs yet</div>
      )}
    </DiagnosticContainer>
  );
};

export default DiagnosticDisplay; 