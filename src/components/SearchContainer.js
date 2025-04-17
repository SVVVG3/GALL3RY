import NFTGrid from './NFTGrid';

<NFTGrid 
  nfts={nfts}
  isLoading={isLoading && nfts.length === 0}
  emptyMessage="No NFTs found for this search. Try another query or NFT type." 
/> 