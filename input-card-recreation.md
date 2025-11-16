# Input Card with Gradient Border Recreation Guide

Complete guide to recreating the card with input fields, labels (Keywords, Creativity), and gradient border effect from the Use Cases section.

---

## Table of Contents

1. [Overview](#overview)
2. [Visual Design](#visual-design)
3. [Component Structure](#component-structure)
4. [Complete CSS Styling](#complete-css-styling)
5. [Typography Details](#typography-details)
6. [Border & Gradient Effects](#border--gradient-effects)
7. [Form Elements](#form-elements)
8. [Complete Code](#complete-code)

---

## Overview

The card is a **form input card** with:
- Gradient background with transparency
- 1px white border with 20% opacity
- Rounded corners (30px border-radius)
- White text labels
- Semi-transparent input fields
- Range slider (Creativity)
- Gradient "Generate" button

**Used In:** Use Cases section (AI Does it faster & better)

---

## Visual Design

### Card Appearance

```
┌─────────────────────────────────────────┐
│  Keywords                               │
│  ┌─────────────────────────────────┐   │
│  │ AI 2023                         │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Creativity                             │
│  ─────────────────●──────               │
│                                         │
│  Language          Language             │
│  ┌──────────┐    ┌──────────────┐      │
│  │ Swedish  │    │ Professional │      │
│  └──────────┘    └──────────────┘      │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │      Generate            ›       │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### Design Specifications

| Property | Value |
|----------|-------|
| **Max Width** | 450px |
| **Border Radius** | 30px |
| **Border** | 1px solid rgba(255, 255, 255, 0.2) |
| **Background** | Gradient with 20% opacity |
| **Padding** | 45px |
| **Border Color** | White with 20% transparency |

---

## Component Structure

### TabLeft.jsx (React Component)

```jsx
import RangeSlider from "react-range-slider-input";
import "react-range-slider-input/dist/style.css";

function TabLeft() {
  return (
    <div className="cases-details-left">
      {/* Keywords Input */}
      <p>Keywords</p>
      <input type="text" placeholder="AI 2023" />

      {/* Creativity Slider */}
      <p>Creativity</p>
      <RangeSlider
        className="single-thumb"
        defaultValue={[0, 60]}
        thumbsDisabled={[true, false]}
        rangeSlideDisabled={true}
        onThumbDragStart={false}
      />

      {/* Language Inputs */}
      <div className="group-language">
        <div className="inner-left">
          <p>Language</p>
          <input type="text" placeholder="Swedish" />
        </div>
        <div>
          <p>Language</p>
          <input type="text" placeholder="Professional" />
        </div>
      </div>

      {/* Generate Button */}
      <button className="gradient-btn">Generate</button>
    </div>
  );
}

export default TabLeft;
```

---

## Complete CSS Styling

### Card Container

```css
.cases-details-left {
  /* Border & Shape */
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 30px;

  /* Spacing */
  padding: 45px;
  max-width: 450px;

  /* Gradient Background with 20% opacity */
  background: linear-gradient(
    89.78deg,
    rgba(200, 189, 255, 0.2) -31.69%,
    rgba(186, 166, 255, 0.2) -22.78%,
    rgba(103, 33, 255, 0.2) 27.93%,
    rgba(0, 203, 255, 0.2) 99.79%
  );
}
```

### Breaking Down the Gradient

The background uses the same purple-to-cyan gradient as other elements, but with **20% opacity**:

```css
/* Color Stops (with 20% opacity) */
rgba(200, 189, 255, 0.2)  /* Light Purple - 20% */
rgba(186, 166, 255, 0.2)  /* Purple - 20% */
rgba(103, 33, 255, 0.2)   /* Main Purple - 20% */
rgba(0, 203, 255, 0.2)    /* Cyan - 20% */
```

---

## Typography Details

### Labels (p tags)

```css
.cases-details-left p {
  /* Typography */
  font-family: var(--tg-body-font-family); /* Outfit */
  font-weight: 500; /* Medium weight */
  font-size: 18px;
  color: var(--tg-white); /* #FFFFFF */

  /* Spacing */
  margin-bottom: 3px;
}
```

**Labels Used:**
- "Keywords"
- "Creativity"
- "Language" (appears twice)

---

## Form Elements

### Input Fields

```css
.cases-details-left input {
  /* Layout */
  width: 100%;
  display: block;

  /* Typography */
  font-size: 14px;
  letter-spacing: 0.02em;
  color: var(--tg-white); /* #FFFFFF */

  /* Background & Border */
  background: rgba(230, 238, 251, 0.08); /* Light background with 8% opacity */
  border: 1px solid rgba(230, 238, 251, 0.13); /* Border with 13% opacity */
  border-radius: 5px;

  /* Spacing */
  padding: 6px 10px;
  margin-bottom: 5px;
}

/* Input placeholder styling */
.cases-details-left input::placeholder {
  color: rgba(255, 255, 255, 0.6); /* Semi-transparent white */
}
```

**Placeholder Examples:**
- "AI 2023"
- "Swedish"
- "Professional"

---

## Range Slider Styling

### Creativity Slider

```css
/* Range Slider Container */
.cases-details-left .range-slider {
  height: 4px;
  background-color: var(--tg-primary-color); /* #6721FF */
}

/* Slider Thumb (Draggable Circle) */
.cases-details-left .range-slider .range-slider__thumb {
  width: 15px;
  height: 15px;
  background-color: var(--tg-primary-color); /* #6721FF */
}

/* Hide the lower (disabled) thumb for single-thumb slider */
.cases-details-left .single-thumb .range-slider__thumb[data-lower] {
  width: 0;
}

/* Active range portion */
.cases-details-left .range-slider .range-slider__range {
  border-radius: 0px;
  height: 4px;
  background-color: var(--tg-primary-color); /* #6721FF */
}

/* Hide the underlying input element */
.single-thumb.range-slider > input {
  visibility: hidden;
}
```

---

## Language Input Group

### Two-Column Layout

```css
.cases-details-left .group-language {
  /* Layout */
  display: flex;
  gap: 20px;

  /* Spacing */
  margin: 18px 0px;
}

/* Swedish input (narrower) */
.cases-details-left .group-language .inner-left input {
  width: 82px;
}

/* Professional input (wider - default width) */
```

**Layout:**
- **Left Column:** "Language" label + "Swedish" input (82px wide)
- **Right Column:** "Language" label + "Professional" input (fills remaining space)
- **Gap:** 20px between columns

---

## Generate Button

### Button Styling

```css
.cases-details-left .gradient-btn {
  /* Layout */
  width: 100%;

  /* Typography */
  text-transform: capitalize; /* "Generate" instead of "GENERATE" */

  /* Spacing */
  padding: 13px;
}

/* Custom arrow icon for this button */
.cases-details-left .gradient-btn::after {
  content: "\f105"; /* Font Awesome angle-right (›) */
  transform: none; /* No rotation (unlike other gradient buttons) */
}
```

**Differences from Standard Gradient Button:**
- Full width (100% instead of auto)
- Capitalized text (not uppercase)
- Different arrow icon (› instead of →)
- No arrow rotation on hover

---

## Border & Gradient Effects

### White Border with Transparency

The card uses a subtle white border that blends with the gradient background:

```css
border: 1px solid rgba(255, 255, 255, 0.2);
```

This creates a soft, glowing outline effect that's visible but not harsh.

### Gradient Background Breakdown

```css
background: linear-gradient(
  89.78deg,                         /* Nearly horizontal gradient */
  rgba(200, 189, 255, 0.2) -31.69%, /* Light purple starts before card */
  rgba(186, 166, 255, 0.2) -22.78%, /* Purple */
  rgba(103, 33, 255, 0.2) 27.93%,   /* Main purple in middle */
  rgba(0, 203, 255, 0.2) 99.79%     /* Cyan at end */
);
```

**Why 20% opacity?**
- Maintains readability of text
- Creates subtle, elegant effect
- Doesn't overpower the white border
- Lets the dark background show through

---

## Complete Code

### HTML/JSX Structure

```jsx
import RangeSlider from "react-range-slider-input";
import "react-range-slider-input/dist/style.css";
import "./card-styles.css";

function InputCard() {
  return (
    <div className="cases-details-left">
      {/* Keywords Section */}
      <p>Keywords</p>
      <input type="text" placeholder="AI 2023" />

      {/* Creativity Slider Section */}
      <p>Creativity</p>
      <RangeSlider
        className="single-thumb"
        defaultValue={[0, 60]}
        thumbsDisabled={[true, false]}
        rangeSlideDisabled={true}
        onThumbDragStart={false}
      />

      {/* Language Section (Two Columns) */}
      <div className="group-language">
        <div className="inner-left">
          <p>Language</p>
          <input type="text" placeholder="Swedish" />
        </div>
        <div>
          <p>Language</p>
          <input type="text" placeholder="Professional" />
        </div>
      </div>

      {/* Generate Button */}
      <button className="gradient-btn">Generate</button>
    </div>
  );
}

export default InputCard;
```

### Complete CSS (card-styles.css)

```css
/* ===========================
   Card Container
   =========================== */
.cases-details-left {
  /* Border & Shape */
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 30px;

  /* Spacing */
  padding: 45px;
  max-width: 450px;

  /* Gradient Background */
  background: linear-gradient(
    89.78deg,
    rgba(200, 189, 255, 0.2) -31.69%,
    rgba(186, 166, 255, 0.2) -22.78%,
    rgba(103, 33, 255, 0.2) 27.93%,
    rgba(0, 203, 255, 0.2) 99.79%
  );
}

/* ===========================
   Labels (p tags)
   =========================== */
.cases-details-left p {
  font-weight: 500;
  font-size: 18px;
  color: var(--tg-white);
  margin-bottom: 3px;
}

/* ===========================
   Input Fields
   =========================== */
.cases-details-left input {
  /* Layout */
  width: 100%;
  display: block;

  /* Typography */
  font-size: 14px;
  letter-spacing: 0.02em;
  color: var(--tg-white);

  /* Background & Border */
  background: rgba(230, 238, 251, 0.08);
  border: 1px solid rgba(230, 238, 251, 0.13);
  border-radius: 5px;

  /* Spacing */
  padding: 6px 10px;
  margin-bottom: 5px;
}

.cases-details-left input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

.cases-details-left input:focus {
  outline: none;
  border-color: var(--tg-primary-color);
}

/* ===========================
   Range Slider
   =========================== */
.cases-details-left .range-slider {
  height: 4px;
  background-color: var(--tg-primary-color);
}

.cases-details-left .range-slider .range-slider__thumb {
  width: 15px;
  height: 15px;
  background-color: var(--tg-primary-color);
}

.cases-details-left .single-thumb .range-slider__thumb[data-lower] {
  width: 0;
}

.cases-details-left .range-slider .range-slider__range {
  border-radius: 0px;
  height: 4px;
  background-color: var(--tg-primary-color);
}

.single-thumb.range-slider > input {
  visibility: hidden;
}

/* ===========================
   Language Input Group
   =========================== */
.cases-details-left .group-language {
  display: flex;
  gap: 20px;
  margin: 18px 0px;
}

.cases-details-left .group-language .inner-left input {
  width: 82px;
}

/* ===========================
   Generate Button
   =========================== */
.cases-details-left .gradient-btn {
  width: 100%;
  text-transform: capitalize;
  padding: 13px;
}

.cases-details-left .gradient-btn::after {
  content: "\f105"; /* angle-right icon */
  transform: none;
}
```

### CSS Variables Required

```css
:root {
  --tg-white: #ffffff;
  --tg-primary-color: #6721FF;
  --tg-body-font-family: 'Outfit', sans-serif;
}
```

---

## NPM Packages Required

### React Range Slider Input

```bash
npm install react-range-slider-input
```

**Import in component:**
```jsx
import RangeSlider from "react-range-slider-input";
import "react-range-slider-input/dist/style.css";
```

**Documentation:** https://www.npmjs.com/package/react-range-slider-input

---

## Customization Options

### Change Border Color

```css
.cases-details-left {
  border: 1px solid rgba(103, 33, 255, 0.4); /* Purple border */
}
```

### Change Background Opacity

```css
.cases-details-left {
  background: linear-gradient(
    89.78deg,
    rgba(200, 189, 255, 0.4) -31.69%, /* Change 0.2 to 0.4 for more opacity */
    rgba(186, 166, 255, 0.4) -22.78%,
    rgba(103, 33, 255, 0.4) 27.93%,
    rgba(0, 203, 255, 0.4) 99.79%
  );
}
```

### Change Slider Color

```css
.cases-details-left .range-slider,
.cases-details-left .range-slider .range-slider__thumb,
.cases-details-left .range-slider .range-slider__range {
  background-color: #00CBFF; /* Cyan instead of purple */
}
```

### Adjust Border Radius

```css
.cases-details-left {
  border-radius: 20px; /* Less rounded */
}

/* Or */
.cases-details-left {
  border-radius: 50px; /* More rounded */
}
```

### Change Padding

```css
.cases-details-left {
  padding: 30px; /* Tighter spacing */
}

/* Or */
.cases-details-left {
  padding: 60px; /* More spacious */
}
```

---

## Typography Breakdown

### Font Hierarchy

| Element | Font Family | Font Size | Font Weight | Color |
|---------|-------------|-----------|-------------|-------|
| **Labels (p)** | Outfit | 18px | 500 (Medium) | White (#FFFFFF) |
| **Input Text** | Outfit (inherited) | 14px | 400 (Regular) | White (#FFFFFF) |
| **Placeholders** | Outfit (inherited) | 14px | 400 (Regular) | White 60% opacity |
| **Button** | Outfit (inherited) | 14px | 600 (Semi-Bold) | White (#FFFFFF) |

---

## Border Effect Explained

### Layer Breakdown

1. **Outer Border** (1px white with 20% opacity)
   ```css
   border: 1px solid rgba(255, 255, 255, 0.2);
   ```

2. **Gradient Background** (Purple to cyan with 20% opacity)
   ```css
   background: linear-gradient(...);
   ```

3. **Dark Background** (Shows through from behind)
   - The page background (#160042) shows through the transparent gradient

### Visual Stacking

```
┌─ White Border (20% opacity)
│  ┌─ Gradient Background (20% opacity)
│  │  ┌─ Dark Page Background (#160042)
│  │  │
│  │  └── Shows through transparent layers
│  └────── Creates glowing effect
└──────────── Subtle outline
```

---

## Input Field Details

### Background Colors Explained

**Input Background:**
```css
rgba(230, 238, 251, 0.08) /* Light blue-white with 8% opacity */
```

**Input Border:**
```css
rgba(230, 238, 251, 0.13) /* Same color with 13% opacity */
```

**Why these values?**
- Creates subtle depth without being too prominent
- Border is slightly more visible than background (13% vs 8%)
- Light blue tint (#E6EEFB) complements the purple gradient

### Focus State (Recommended Addition)

```css
.cases-details-left input:focus {
  outline: none;
  border-color: var(--tg-primary-color); /* Purple highlight */
  background: rgba(230, 238, 251, 0.12); /* Slightly brighter */
}
```

---

## Responsive Design

### Mobile Adjustments

```css
@media (max-width: 768px) {
  .cases-details-left {
    padding: 30px; /* Less padding on mobile */
    max-width: 100%; /* Full width */
  }

  .cases-details-left .group-language {
    flex-direction: column; /* Stack language inputs */
    gap: 0;
  }

  .cases-details-left .group-language .inner-left input {
    width: 100%; /* Full width on mobile */
  }
}
```

---

## Animation (From Use Cases Section)

### Fade-In Effect

```css
/* When tab becomes active */
.tab-pane.active .cases-details-wrap .cases-details-img {
  animation: taFadeInLeft 0.5s ease-in-out;
}

@keyframes taFadeInLeft {
  0% {
    opacity: 0;
    transform: translateX(-30px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
}
```

---

## Implementation Checklist

- [ ] Install `react-range-slider-input` package
- [ ] Create component file (TabLeft.jsx or InputCard.jsx)
- [ ] Create CSS file with all styles
- [ ] Add CSS variables to your app
- [ ] Import Font Awesome for button icon
- [ ] Test gradient background visibility
- [ ] Test border appearance
- [ ] Verify input placeholder styling
- [ ] Test range slider functionality
- [ ] Test responsive behavior
- [ ] Add focus states to inputs
- [ ] Test "Generate" button click handler

---

## Common Issues & Solutions

### Border not visible
**Issue:** White border blends with background
**Solution:** Increase border opacity or change color
```css
border: 1px solid rgba(255, 255, 255, 0.4); /* More visible */
```

### Gradient too strong
**Issue:** Background gradient overpowers content
**Solution:** Reduce opacity from 0.2 to lower value
```css
rgba(200, 189, 255, 0.1) /* Use 0.1 instead of 0.2 */
```

### Range slider not working
**Issue:** Slider doesn't respond to drag
**Solution:** Verify package is installed and imported correctly
```bash
npm install react-range-slider-input
```

### Input text not visible
**Issue:** White text on light background
**Solution:** Check that dark background is showing through
```css
background: rgba(230, 238, 251, 0.08); /* Keep opacity low */
```

---

## Quick Reference

### Key CSS Values

| Property | Value |
|----------|-------|
| **Border** | 1px solid rgba(255, 255, 255, 0.2) |
| **Border Radius** | 30px |
| **Background Gradient** | Purple to Cyan (20% opacity) |
| **Padding** | 45px |
| **Max Width** | 450px |
| **Label Font Size** | 18px |
| **Input Font Size** | 14px |
| **Input Background** | rgba(230, 238, 251, 0.08) |
| **Slider Height** | 4px |
| **Slider Thumb** | 15px × 15px |

---

## Color Palette

```css
/* Gradient Colors (with 20% opacity) */
Light Purple:  rgba(200, 189, 255, 0.2)  #C8BDFF
Purple:        rgba(186, 166, 255, 0.2)  #BAA6FF
Main Purple:   rgba(103, 33, 255, 0.2)   #6721FF
Cyan:          rgba(0, 203, 255, 0.2)    #00CBFF

/* Input Colors */
White Text:    rgba(255, 255, 255, 1)    #FFFFFF
Placeholder:   rgba(255, 255, 255, 0.6)
Background:    rgba(230, 238, 251, 0.08) #E6EEFB
Border:        rgba(230, 238, 251, 0.13) #E6EEFB
```

---

## Summary

The input card features:
- **Gradient border effect** - 1px white border (20% opacity) over gradient background
- **Semi-transparent gradient background** - Purple to cyan gradient at 20% opacity
- **Clean typography** - 18px medium weight labels, 14px input text
- **Subtle input styling** - Light backgrounds with minimal borders
- **Purple range slider** - Single-thumb slider for "Creativity"
- **Responsive two-column layout** - Language inputs side-by-side
- **Custom gradient button** - Full-width with different arrow icon

This creates an elegant, modern form interface with a cohesive gradient theme throughout.
