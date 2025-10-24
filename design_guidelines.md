# Sui NFT Battle Garden - Design Guidelines

## Design Approach
**Reference-Based**: This project requires exact adherence to the provided HTML design specifications. The visual identity is fully defined with specific colors, layouts, and animations that must be preserved across both the index landing page and battle game interface.

## Core Design Elements

### Typography
- **Primary Font**: 'Orbitron' (weights: 400, 700) from Google Fonts
- **Hierarchy**:
  - Page titles: 48px, font-weight 700
  - Section headers: 24px, Orbitron
  - Body text: 18-20px, Orbitron
  - Button text: 16-18px, uppercase, Orbitron
  - Battle info: 20px for status updates

### Color Palette (Strict Adherence Required)
- **Primary Green**: #00ff00 (neon green for borders, glows, text highlights)
- **Secondary Green**: #00cc00 (hover states)
- **Accent Cyan**: #00ffcc (battle info text)
- **Yellow**: #ffff00 (status text)
- **Red**: #ff0000 (opponent NFT card shadows)
- **Background Dark**: rgba(0, 50, 0, 0.8) (semi-transparent dark green for headers, sections, footers)
- **Background Black**: #000 (base background color)
- **White**: #ffffff (primary text color)

### Layout System
- **Spacing Units**: Use Tailwind spacing - primary units: 2, 4, 8, 10, 12, 15, 20, 24, 25, 30
- **Container Widths**:
  - Max content width: 900px for info sections
  - Battle options: 700px max-width
  - NFT cards: Fixed 240px width × 336px height (desktop)
  - Logo: 80px width
- **Border Radius**: 8px for buttons, 12px for cards/sections, 15px for info sections
- **Padding**: Sections use 25px, buttons 10-12px vertical / 20-24px horizontal

## Component Library

### Header
- Fixed top navigation bar
- Background: rgba(0, 50, 0, 0.8)
- Border bottom: 2px solid #00ff00
- Box shadow: 0 0 15px #00ff00
- Contains: Logo (left), Navigation links (center), Connect Wallet button (right)
- Height: Auto with 15px vertical padding

### Connect Wallet Button
- 2px solid #00ff00 border
- Linear gradient background: rgba(0, 100, 0, 0.5) to rgba(0, 150, 0, 0.5)
- Box shadow: 0 0 10px #00ff00, 0 0 5px #000000
- Border radius: 8px
- Uppercase text
- Hover: background changes to #00ff00, color to #000, box-shadow: 0 0 20px #00ff00

### NFT Cards
- Dimensions: 240px × 336px (desktop), responsive on mobile
- Border radius: 12px
- Background: rgba(255, 255, 255, 0.1)
- Player card shadow: 0 0 15px #00ff00
- Opponent card shadow: 0 0 15px #ff0000
- Hover: scale(1.05), box-shadow: 0 0 30px #00ff00
- Winner state: Enhanced glow (0 0 20px #00ff00, 0 0 40px #00ff00) with winner overlay

### Battle Layout
- Flexbox horizontal layout: NFT Card 1 | VS | NFT Card 2
- VS text: 48px, #00ff00, text-shadow: 0 0 10px #00ff00
- Margin between elements: 20-25px
- Each NFT card wrapped in trainer-wrapper with health bar below

### Health Bars
- Container: 240px width, 18px height
- Background: rgba(0, 0, 0, 0.8)
- Border radius: 6px
- Inner bar: Linear gradient (to right, #00ff00, #00cc00)
- Box shadow: 0 0 10px #00ff00
- Smooth width transition: 0.3s ease

### Ability Buttons (Battle Options)
- Container: Max-width 700px, max-height 200px, scrollable
- Background: rgba(0, 50, 0, 0.8)
- Border: 2px solid #00ff00
- Border radius: 12px
- Padding: 15px
- Box shadow: 0 0 15px #00ff00
- Individual buttons: 12px/24px padding, transparent background, 2px #00ff00 border, 8px border-radius

### Glow Button Class
- Standard for all action buttons
- Border: 2px solid #00ff00
- Background: transparent
- Box shadow: 0 0 10px #00ff00
- Hover: background #00ff00, color #000, box-shadow: 0 0 25px #00ff00
- Disabled: opacity 0.5

### Info Sections
- Max-width: 900px
- Padding: 25px
- Background: rgba(0, 50, 0, 0.8)
- Border: 2px solid #00ff00
- Border radius: 15px
- Box shadow: 0 0 15px #00ff00
- Left-aligned text for readability

### Footer
- Background: rgba(0, 50, 0, 0.8)
- Border top: 2px solid #00ff00
- Box shadow: 0 0 15px #00ff00
- Padding: 25px
- Center-aligned
- Sponsor links: #00ffcc color, hover to #00ffff with glow

## Animations

### Green Glow (Winner Effect)
```
0%, 100%: box-shadow: 0 0 15px #00ff00
50%: box-shadow: 0 0 30px #00ff00, 0 0 50px #00ff00
Duration: 2s ease-in-out
```

### Shake (Hit Effect)
```
Horizontal oscillation: ±5px at intervals
Duration: 2s ease-in-out
```

### Explode (Title Entry)
```
Scale from 0.5 to 1.2 to 1
Opacity 0 to 1
Duration: 1-2s ease-out
```

### Reduced Motion
- Respect prefers-reduced-motion: Set animation-duration to 0s

## Responsive Behavior

### Mobile (max-width: 768px)
- NFT cards: 100% width, max-width 150px, min-width 100px, aspect-ratio 5/7
- VS text: 36px (reduced from 48px)
- Margins: Reduced to 5px between cards
- Battle area: Horizontal scroll enabled if needed
- Health bars: Match card width (responsive)
- Buttons/sections: Maintain padding proportions

## Background Treatment
- Primary background image: `./assets/background4.jpg`
- Fixed attachment, center center, cover sizing
- Fallback: #000 black
- No-repeat

## Images

### Background Images
- **Main Background**: `background4.jpg` - Dark atmospheric garden/nature scene, fixed full-screen coverage
- Placement: body element, fixed positioning with cover sizing

### NFT Growth Stages
- **seed.jpg**: Growth 0-25 (initial stage)
- **sapling.jpg**: Growth 26-50 (early growth)
- **sapling2.jpg**: Growth 51-75 (advanced growth)
- **full_tree.jpg**: Growth 76-100 (mature stage)
- Placement: Dynamic replacement within NFT cards based on growth points

### Logo/Branding
- **battle.png**: Header logo (80px width), green drop-shadow filter
- Placement: Top-left header, clickable

### Title Image
- Large title graphic (max-width 680px, max-height 300px)
- Center-aligned with explode animation on page load
- Margin: 25px auto 10px

## Assets Folder Structure
```
/assets/
  - background4.jpg (primary background)
  - background1.jpg (alternate)
  - backgrounda.jpg (alternate)
  - seed.jpg (NFT stage 1)
  - sapling.jpg (NFT stage 2)
  - sapling2.jpg (NFT stage 3)
  - full_tree.jpg (NFT stage 4)
  - battle.png (logo/icon)
  - tree.jpg (additional asset)
```

## Critical Implementation Notes
- All asset paths must use relative paths: `./assets/filename.jpg`
- Green glow effects are essential to brand identity - apply consistently
- Orbitron font loading via Google Fonts CDN is mandatory
- Box shadows create depth - multiple layers (inner + outer glow)
- Transitions: 0.3s ease for most hover states
- Z-index management: Cards z-index 1, winner overlay z-index 2, dialogs z-index 1000