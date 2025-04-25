# CSS Organization for GALL3RY NFT App

This directory contains the CSS files for the GALL3RY NFT application.

## CSS Files
- `nft-unified.css`: The primary CSS file that contains all NFT-related styles
- `app.css`: Global application styles
- `folder.css`: Styles for folder-related components
- `errors.css`: Styles for error states and components

## Historical Organization
Previous versions of the application used separate CSS files for each component type.
These have now been consolidated into `nft-unified.css` for better maintainability.

## CSS Structure in nft-unified.css
The unified CSS is organized into logical sections:
- Layout & Containers
- Scrollbars
- Grid Cells
- NFT Card Styles
- Media Containers
- Media Content
- Loading & Error States
- NFT Info Styles
- Vercel NFT Card Specific Styles
- Collection Friends Button
- Animations
- Loading & Empty States
- Placeholders
- Responsive Styles

## Best Practices
When adding new styles:
1. Add them to the unified CSS file (`nft-unified.css`)
2. Follow the section organization pattern
3. Ensure styles work correctly across all components

## NFT Component Styles

The unified CSS file `nft-unified.css` contains all the necessary styles for:

- NFT Gallery container and layout
- NFT Grid with virtualized support
- NFT Cards (standard and Vercel optimized variants)
- Loading states and animations
- Modal and overlay styles for collection friends
- Responsive design for all viewport sizes

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

When adding new styles related to NFT components, please add them to `nft-unified.css` and follow the existing organization pattern.

## Implementation
The GALL3RY NFT application uses a unified CSS approach. All NFT component styles are contained in the `nft-unified.css` file, providing a consistent user experience across the application. 