import Head from 'next/head';
import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import components to reduce main bundle size
const FarcasterUserSearch = dynamic(() => import('../src/components/FarcasterUserSearch'));
const UserStats = dynamic(() => import('../src/components/UserStats'));

export default function Home() {
  useEffect(() => {
    // Emergency fix for Alien Frens NFTs with 403 errors
    const fixAlienFrensImages = () => {
      console.log('Applying global Alien Frens fix from Home page');
      try {
        // Override image src setter
        const originalImageSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
        if (originalImageSrc && originalImageSrc.configurable) {
          Object.defineProperty(HTMLImageElement.prototype, 'src', {
            get: originalImageSrc.get,
            set: function(url) {
              if (typeof url === 'string' && url.includes('alienfrens.mypinata.cloud/ipfs/')) {
                console.log('HOME PAGE FIX: Intercepted Alien Frens URL', url);
                
                const ipfsMatch = url.match(/\/ipfs\/([^/?#]+)/);
                if (ipfsMatch && ipfsMatch[1]) {
                  const ipfsHash = ipfsMatch[1];
                  // Try multiple gateways directly (not using our proxy)
                  const alternativeGateways = [
                    `https://nftstorage.link/ipfs/${ipfsHash}`,
                    `https://dweb.link/ipfs/${ipfsHash}`,
                    `https://ipfs.io/ipfs/${ipfsHash}`
                  ];
                  
                  // Use the first gateway
                  const fixedUrl = alternativeGateways[0];
                  console.log('HOME PAGE FIX: Using direct gateway', fixedUrl);
                  originalImageSrc.set.call(this, fixedUrl);
                  return;
                }
              }
              
              // Default for other URLs
              originalImageSrc.set.call(this, url);
            },
            configurable: true
          });
          
          // Add a global debug function to help with manual fixing
          window.fixAllFrens = () => {
            const images = document.querySelectorAll('img[src*="alienfrens.mypinata.cloud"]');
            console.log(`Found ${images.length} problematic images to fix`);
            
            images.forEach(img => {
              const src = img.getAttribute('src');
              const ipfsMatch = src.match(/\/ipfs\/([^/?#]+)/);
              if (ipfsMatch && ipfsMatch[1]) {
                const ipfsHash = ipfsMatch[1];
                const newSrc = `https://nftstorage.link/ipfs/${ipfsHash}`;
                console.log(`Manually fixing: ${src} -> ${newSrc}`);
                img.src = newSrc;
              }
            });
            
            return `Fixed ${images.length} images`;
          };
        }
      } catch (error) {
        console.error('Error applying Alien Frens fix:', error);
      }
    };
    
    // Apply fix immediately
    fixAlienFrensImages();
    
    // Also apply fix after a delay to catch any late-loaded elements
    setTimeout(fixAlienFrensImages, 2000);
  }, []);
  
  return (
    <div className="home-container">
      <Head>
        <title>NFT Viewer - Explore NFTs by Farcaster Username</title>
        <meta name="description" content="View NFTs owned by Farcaster users" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <main className="main-content">
        <FarcasterUserSearch />
      </main>
      
      <footer className="app-footer">
        <UserStats />
      </footer>
    </div>
  );
} 