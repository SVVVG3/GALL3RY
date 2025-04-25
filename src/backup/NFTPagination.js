import React from 'react';
import { useNFT } from '../contexts/NFTContext';
import '../styles/nft-unified.css';

/**
 * NFT Pagination Component
 * 
 * Provides UI for navigating between pages of NFTs
 * Uses pagination controls from NFTContext
 */
const NFTPagination = () => {
  const {
    currentPage,
    totalPages,
    handlePageChange,
    itemsPerPage,
    handleItemsPerPageChange,
    totalItems
  } = useNFT();

  // Generate page numbers to display (show current page, first, last, and some adjacent pages)
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxPagesShown = 5; // Maximum number of page buttons to show
    
    if (totalPages <= maxPagesShown) {
      // If we have few pages, show all of them
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      // Always show first page
      pageNumbers.push(1);
      
      // Calculate range around current page
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);
      
      // Add ellipsis after first page if there's a gap
      if (start > 2) {
        pageNumbers.push('...');
      }
      
      // Add pages around current page
      for (let i = start; i <= end; i++) {
        pageNumbers.push(i);
      }
      
      // Add ellipsis before last page if there's a gap
      if (end < totalPages - 1) {
        pageNumbers.push('...');
      }
      
      // Always show last page
      if (totalPages > 1) {
        pageNumbers.push(totalPages);
      }
    }
    
    return pageNumbers;
  };

  const itemsPerPageOptions = [12, 24, 48, 96];

  return (
    <div className="nft-pagination">
      <div className="pagination-info">
        <span>
          Showing {totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} NFTs
        </span>
        
        <div className="items-per-page">
          <label htmlFor="items-per-page">Items per page:</label>
          <select 
            id="items-per-page"
            value={itemsPerPage}
            onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
            className="items-per-page-select"
          >
            {itemsPerPageOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="pagination-controls">
        <button 
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="pagination-button"
          aria-label="Previous page"
        >
          &laquo;
        </button>
        
        {getPageNumbers().map((page, index) => (
          page === '...' ? (
            <span key={`ellipsis-${index}`} className="pagination-ellipsis">...</span>
          ) : (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              className={`pagination-button ${currentPage === page ? 'active' : ''}`}
              aria-label={`Page ${page}`}
              aria-current={currentPage === page ? 'page' : undefined}
            >
              {page}
            </button>
          )
        ))}
        
        <button 
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages || totalPages === 0}
          className="pagination-button"
          aria-label="Next page"
        >
          &raquo;
        </button>
      </div>
    </div>
  );
};

export default NFTPagination; 