import axios from 'axios';

const API_KEY = process.env.REACT_APP_ZAPPER_API_KEY;
const API_URL = 'https://public.zapper.xyz/graphql';

const headers = {
  'Content-Type': 'application/json',
  'x-zapper-api-key': API_KEY
};

// Cache for GraphQL responses
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const fetchZapperData = async (query, variables) => {
  const cacheKey = JSON.stringify({ query, variables });
  const cachedData = cache.get(cacheKey);

  if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
    return cachedData.data;
  }

  try {
    const response = await axios({
      url: API_URL,
      method: 'post',
      headers,
      data: {
        query,
        variables
      }
    });

    if (response.data.errors) {
      throw new Error(`GraphQL Errors: ${JSON.stringify(response.data.errors)}`);
    }

    // Cache the successful response
    cache.set(cacheKey, {
      data: response.data.data,
      timestamp: Date.now()
    });

    return response.data.data;
  } catch (error) {
    console.error('Error fetching from Zapper API:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
};

// Helper function to validate Ethereum addresses
export const isValidAddress = (address) => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

// Helper function to implement exponential backoff
export const fetchWithRetry = async (query, variables, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetchZapperData(query, variables);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}; 