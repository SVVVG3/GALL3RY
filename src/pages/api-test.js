import React, { useEffect, useState } from 'react';
import { testChainRouting } from '../utils/apiTest';

export default function ApiTestPage() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function runTest() {
    setLoading(true);
    setError(null);
    try {
      const testResults = await testChainRouting();
      setResults(testResults);
    } catch (err) {
      console.error('Test error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">API Chain Routing Test</h1>
      
      <button 
        onClick={runTest}
        disabled={loading}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4 disabled:opacity-50"
      >
        {loading ? 'Running Tests...' : 'Run Chain Tests'}
      </button>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      )}
      
      {results && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Test Results</h2>
          
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-300">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b">Chain</th>
                  <th className="py-2 px-4 border-b">Status</th>
                  <th className="py-2 px-4 border-b">NFT Count</th>
                  <th className="py-2 px-4 border-b">Time</th>
                  <th className="py-2 px-4 border-b">Chain Data</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(results).map(([chain, result]) => {
                  if (chain === 'multiChain') return null;
                  
                  return (
                    <tr key={chain}>
                      <td className="py-2 px-4 border-b font-medium">{chain}</td>
                      <td className="py-2 px-4 border-b">
                        <span className={`inline-block px-2 py-1 rounded ${result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {result.success ? 'Success' : 'Failed'}
                        </span>
                      </td>
                      <td className="py-2 px-4 border-b">{result.nftCount || 0}</td>
                      <td className="py-2 px-4 border-b">{result.elapsed || '-'}</td>
                      <td className="py-2 px-4 border-b text-sm">
                        {result.chainInfo ? JSON.stringify(result.chainInfo) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {results.multiChain && (
            <div className="mt-6">
              <h3 className="text-lg font-bold">Multi-Chain Test</h3>
              <div className="bg-gray-100 p-4 rounded">
                <p><span className="font-medium">Status:</span> 
                  <span className={results.multiChain.success ? 'text-green-600' : 'text-red-600'}>
                    {results.multiChain.success ? 'Success' : 'Failed'}
                  </span>
                </p>
                <p><span className="font-medium">Total NFTs:</span> {results.multiChain.totalNfts || 0}</p>
                <p><span className="font-medium">Time:</span> {results.multiChain.elapsed || '-'}</p>
                {results.multiChain.error && (
                  <p className="text-red-600"><span className="font-medium">Error:</span> {results.multiChain.error}</p>
                )}
              </div>
            </div>
          )}
          
          <div className="mt-4">
            <p className="text-sm text-gray-600">Note: Check the browser console for detailed test output.</p>
          </div>
        </div>
      )}
    </div>
  );
} 