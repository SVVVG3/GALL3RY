import React, { useState, useEffect } from 'react';

/**
 * Debug component to troubleshoot NFT image loading issues
 */
const DebugImageLoader = () => {
  const [testState, setTestState] = useState({
    loading: false,
    results: []
  });

  // Test various image loading scenarios
  const runImageTests = async () => {
    setTestState({
      loading: true,
      results: []
    });

    const results = [];
    const testUrls = [
      // Placeholder SVG (should always work)
      { 
        name: 'Static Placeholder SVG', 
        url: '/assets/placeholder-nft.svg'
      },
      // IPFS URL through proxy
      { 
        name: 'IPFS via proxy',
        url: '/api/image-proxy?url=' + encodeURIComponent('ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/1')
      },
      // Normal HTTP URL through proxy
      { 
        name: 'HTTP via proxy',
        url: '/api/image-proxy?url=' + encodeURIComponent('https://i.seadn.io/gae/2C4iqT72vQGad9a02jrX24-F5ZXbkYfkAs9pUlxhUyYjcpNJ7djPmLl9MV6HUJsEjgoMyLjnGjWxjaIcvPpm-8P1k88stPMIkS-pWA?auto=format&w=1000')
      }
    ];

    // Test each URL
    for (const test of testUrls) {
      const result = {
        name: test.name,
        url: test.url,
        success: false,
        error: null,
        loadTime: null
      };

      try {
        const startTime = performance.now();
        
        // Create a promise that resolves when the image loads or rejects on error
        const loadPromise = new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = (e) => reject(new Error(`Failed to load image: ${e.type}`));
          img.src = test.url;
        });
        
        // Wait for image to load with a timeout
        await Promise.race([
          loadPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout after 5s')), 5000))
        ]);
        
        const endTime = performance.now();
        result.success = true;
        result.loadTime = Math.round(endTime - startTime);
      } catch (error) {
        result.error = error.message;
      }
      
      results.push(result);
      setTestState({
        loading: true,
        results: [...results]
      });
    }
    
    setTestState({
      loading: false,
      results
    });
  };

  return (
    <div className="debug-image-loader" style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>Image Loading Diagnostic</h2>
      
      <button 
        onClick={runImageTests}
        disabled={testState.loading}
        style={{
          padding: '8px 16px',
          background: '#3498db',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: testState.loading ? 'wait' : 'pointer',
          marginBottom: '20px'
        }}
      >
        {testState.loading ? 'Running Tests...' : 'Run Image Tests'}
      </button>
      
      <div style={{ marginBottom: '20px' }}>
        <strong>Browser Info:</strong> {navigator.userAgent}
      </div>
      
      <div>
        {testState.results.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Test</th>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Result</th>
              </tr>
            </thead>
            <tbody>
              {testState.results.map((result, index) => (
                <tr key={index}>
                  <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                    {result.name}
                    <div style={{ fontSize: '12px', color: '#666', wordBreak: 'break-all' }}>
                      {result.url}
                    </div>
                  </td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                    {result.success ? 
                      <span style={{ color: 'green' }}>✅ Pass</span> : 
                      <span style={{ color: 'red' }}>❌ Fail</span>
                    }
                  </td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                    {result.success ? 
                      <span>Loaded in {result.loadTime}ms</span> : 
                      <span style={{ color: 'red' }}>{result.error}</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        
        {testState.results.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <h3>Sample Images</h3>
            {testState.results.map((result, index) => (
              <div key={index} style={{ marginBottom: '10px' }}>
                <p>{result.name}</p>
                <img 
                  src={result.url} 
                  alt={result.name}
                  style={{ 
                    maxWidth: '150px', 
                    maxHeight: '150px',
                    border: '1px solid #ddd',
                    padding: '5px'
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DebugImageLoader; 