import { AlchemyApi } from '../../services/alchemyService';

/**
 * API route to fetch all known spam contracts
 */
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  try {
    const { network } = req.query;
    const chainId = network || 'eth';
    
    // Initialize Alchemy service
    const alchemyService = new AlchemyApi();
    
    // Fetch spam contracts for the requested network
    const spamContracts = await alchemyService.getSpamContracts(chainId);
    
    return res.status(200).json({
      network: chainId,
      count: spamContracts.length,
      contractAddresses: spamContracts
    });
  } catch (error) {
    console.error('Error fetching spam contracts:', error);
    return res.status(500).json({ 
      error: 'Error fetching spam contracts',
      message: error.message
    });
  }
} 