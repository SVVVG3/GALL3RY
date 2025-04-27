import { AlchemyApi } from '../../services/alchemyService';

/**
 * API route to check if a contract address is spam
 */
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  try {
    const { contracts, network } = req.query;
    
    if (!contracts) {
      return res.status(400).json({ 
        error: 'Missing required parameter: contracts' 
      });
    }
    
    const contractAddresses = Array.isArray(contracts) 
      ? contracts 
      : [contracts];
    
    const chainId = network || 'eth';
    
    // Initialize Alchemy service
    const alchemyService = new AlchemyApi();
    
    if (contractAddresses.length === 1) {
      // Single contract check
      const isSpam = await alchemyService.isSpamContract(
        contractAddresses[0], 
        chainId
      );
      
      return res.status(200).json({
        contractAddress: contractAddresses[0],
        isSpam,
        network: chainId
      });
    } else {
      // Batch check
      const results = await Promise.all(
        contractAddresses.map(async (contract) => {
          const isSpam = await alchemyService.isSpamContract(
            contract,
            chainId
          );
          
          return {
            contractAddress: contract,
            isSpam
          };
        })
      );
      
      return res.status(200).json({
        results,
        network: chainId
      });
    }
  } catch (error) {
    console.error('Error checking spam status:', error);
    return res.status(500).json({ 
      error: 'Error checking spam status',
      message: error.message
    });
  }
} 