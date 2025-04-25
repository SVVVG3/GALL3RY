import React, { useState } from 'react';
import '../styles/nft-unified.css';

/**
 * Pagination component for NFT Gallery
 * 
 * Features:
 * - Current page indicator
 * - Next/previous navigation
 * - Items per page selector
 * - Jump to specific page
 */
const Pagination = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
}) => {
  const [jumpToPage, setJumpToPage] = useState('');

  // Don't render pagination if there's only one page
  if (totalPages <= 1) return null;

  // Generate array of visible page numbers
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxPagesToShow = 5; // Number of page buttons to show
    
    if (totalPages <= maxPagesToShow) {
      // Show all pages if total is less than max
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      // Always show first page
      pageNumbers.push(1);
      
      // Calculate range around current page
      let rangeStart = Math.max(2, currentPage - 1);
      let rangeEnd = Math.min(totalPages - 1, currentPage + 1);
      
      // Adjust range to show always show maxPagesToShow-2 pages (minus first and last)
      const maxMiddlePages = maxPagesToShow - 2;
      if (rangeEnd - rangeStart + 1 < maxMiddlePages) {
        if (currentPage < totalPages / 2) {
          // Near the beginning, expand range end
          rangeEnd = Math.min(totalPages - 1, rangeStart + maxMiddlePages - 1);
        } else {
          // Near the end, expand range start
          rangeStart = Math.max(2, rangeEnd - maxMiddlePages + 1);
        }
      }
      
      // Add ellipsis after first page if needed
      if (rangeStart > 2) {
        pageNumbers.push('...');
      }
      
      // Add middle pages
      for (let i = rangeStart; i <= rangeEnd; i++) {
        pageNumbers.push(i);
      }
      
      // Add ellipsis before last page if needed
      if (rangeEnd < totalPages - 1) {
        pageNumbers.push('...');
      }
      
      // Always show last page
      pageNumbers.push(totalPages);
    }
    
    return pageNumbers;
  };

  // Handle page button click
  const handlePageClick = (page) => {
    if (page !== '...' && page !== currentPage) {
      onPageChange(page);
    }
  };

  // Handle items per page change
  const handleItemsPerPageChange = (e) => {
    const newItemsPerPage = parseInt(e.target.value, 10);
    onItemsPerPageChange(newItemsPerPage);
  };

  // Handle jump to page input change
  const handleJumpToPageChange = (e) => {
    setJumpToPage(e.target.value);
  };

  // Handle jump to page submission
  const handleJumpToPageSubmit = (e) => {
    e.preventDefault();
    const pageNumber = parseInt(jumpToPage, 10);
    if (!isNaN(pageNumber) && pageNumber >= 1 && pageNumber <= totalPages) {
      onPageChange(pageNumber);
      setJumpToPage('');
    }
  };

  return (
    <div className="nft-pagination">
      <div className="pagination-info">
        <span>
          Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} - {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} NFTs
        </span>
        
        <div className="items-per-page">
          <span>Show</span>
          <select 
            className="items-per-page-select"
            value={itemsPerPage}
            onChange={handleItemsPerPageChange}
          >
            <option value={24}>24</option>
            <option value={48}>48</option>
            <option value={96}>96</option>
          </select>
          <span>per page</span>
        </div>
      </div>
      
      <div className="pagination-controls">
        <button 
          className="pagination-button"
          onClick={() => handlePageClick(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          &laquo;
        </button>
        
        {getPageNumbers().map((page, index) => (
          <React.Fragment key={index}>
            {page === '...' ? (
              <span className="pagination-ellipsis">...</span>
            ) : (
              <button
                className={`pagination-button ${page === currentPage ? 'active' : ''}`}
                onClick={() => handlePageClick(page)}
                aria-label={`Page ${page}`}
                aria-current={page === currentPage ? 'page' : undefined}
              >
                {page}
              </button>
            )}
          </React.Fragment>
        ))}
        
        <button 
          className="pagination-button"
          onClick={() => handlePageClick(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Next page"
        >
          &raquo;
        </button>
        
        <form onSubmit={handleJumpToPageSubmit} className="jump-to-page">
          <input
            type="text"
            placeholder="Go to page"
            value={jumpToPage}
            onChange={handleJumpToPageChange}
            className="jump-to-page-input"
            aria-label="Jump to page"
          />
          <button 
            type="submit" 
            className="pagination-button jump-button"
            disabled={!jumpToPage}
            aria-label="Go to page"
          >
            Go
          </button>
        </form>
      </div>
    </div>
  );
};

export default Pagination; 