import { getAlchemyApiKey } from '../../src/utils/runtimeConfig';

export default async function handler(req, res) {
  try {
    const { owner, chain = 'eth', withMetadata, pageSize, pageKey, excludeSpam, excludeAirdrops } = req.query;
    
    // Get API key securely from environment
    const apiKey = await getAlchemyApiKey();
    if (!apiKey) {
      throw new Error('Alchemy API key not configured');
    }

    // Get the network name
    const network = getNetworkFromChainId(chain);
    
    // Construct base URL
    const baseUrl = `https://${network}.g.alchemy.com/nft/v3/${apiKey}/getNFTsForOwner`;
    
    // Build query parameters
    const queryParams = new URLSearchParams({
      owner,
      withMetadata: withMetadata || 'true',
      pageSize: pageSize || '100'
    });

    // Add filters if specified
    const excludeFilters = [];
    if (excludeSpam === 'true') excludeFilters.push('SPAM');
    if (excludeAirdrops === 'true') excludeFilters.push('AIRDROP');
    
    // Only add excludeFilters if we have any
    if (excludeFilters.length > 0) {
      excludeFilters.forEach(filter => {
        queryParams.append('excludeFilters[]', filter);
      });
    }

    // Add pageKey if provided
    if (pageKey) {
      queryParams.append('pageKey', pageKey);
    }

    const url = `${baseUrl}?${queryParams}`;
    
    const response = await fetch(url, {
      headers: {
        'accept': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Alchemy API error: ${error}`);
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Alchemy proxy error:', error);
    res.status(500).json({ error: 'Failed to fetch NFTs' });
  }
}

function getNetworkFromChainId(chainId) {
  switch (chainId.toLowerCase()) {
    case 'eth':
      return 'eth-mainnet';
    case 'polygon':
      return 'polygon-mainnet';
    case 'opt':
      return 'opt-mainnet';
    case 'arb':
      return 'arb-mainnet';
    case 'base':
      return 'base-mainnet';
    default:
      return 'eth-mainnet';
  }
} 