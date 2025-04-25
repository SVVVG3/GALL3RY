# CSS Structure

## Consolidated NFT Component Styles

The NFT component styles have been consolidated into a single file `nft-components.css`. This file contains all the necessary styles for:

- NFT Gallery container and layout
- NFT Grid with virtualized support
- NFT Cards (standard and Vercel optimized variants)
- Loading states and animations
- Modal and overlay styles for collection friends
- Responsive design for all viewport sizes

### Previously Separate Files (Now Consolidated)

The following files have been consolidated into `nft-components.css`:
- `NFTGrid.css`
- `NFTGallery.css`
- `NFTCard.css`

### Key Style Classes

#### Container Classes
- `.nft-gallery-container` - Main gallery container
- `.nft-grid-container` - Grid container 
- `.virtualized-grid-container` - Container for virtualized grid
- `.virtualized-grid` - The actual virtualized grid component

#### Card Classes
- `.nft-card` - Standard NFT card
- `.vercel-nft-card` - Vercel-optimized NFT card
- `.nft-image-container` - Container for NFT media
- `.nft-info` - Container for NFT information
- `.nft-name`, `.nft-collection`, `.nft-token-id`, `.nft-price` - Text elements

#### State Classes
- `.nft-grid-loading` - Loading state for the grid
- `.nft-grid-empty` - Empty state for the grid
- `.loading-indicator` - Loading indicator container
- `.loading-spinner` - Spinner animation element

#### Modal Classes
- `.modal-overlay` - Modal background overlay
- `.modal-container` - Modal content container

## Responsive Breakpoints

The CSS includes responsive breakpoints for:
- Desktop (> 1200px)
- Small desktop (992px - 1200px)
- Tablet (768px - 992px)
- Mobile (576px - 768px)
- Small mobile (< 576px)

## Adding New Styles

When adding new styles related to NFT components, please add them to `nft-components.css` and follow the existing organization pattern. 