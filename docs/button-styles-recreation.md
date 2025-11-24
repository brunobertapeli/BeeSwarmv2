# Button & Typography Styles Guide

Complete guide to recreating the button styles and typography used in the HomeOne page, including "START A FREE TRIAL", "HOW DEX.AI WORK", and "SIGN IN" buttons.

---

## Table of Contents

1. [Typography & Fonts](#typography--fonts)
2. [Button Styles](#button-styles)
3. [Icon System](#icon-system)
4. [Complete Code Examples](#complete-code-examples)

---

## Typography & Fonts

### Font Families Used

```css
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100;200;300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800&family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400;1,500;1,600;1,700;1,800&display=swap');

:root {
  /* Font Families */
  --tg-body-font-family: 'Outfit', sans-serif;
  --tg-heading-font-family: 'Plus Jakarta Sans', sans-serif;
  --tg-playfair-font-family: 'Playfair Display', serif;

  /* Font Weights */
  --tg-body-font-weight: 400;
  --tg-heading-font-weight: 700;

  /* Font Sizes */
  --tg-body-font-size: 16px;

  /* Colors */
  --tg-primary-color: #6721FF;
  --tg-secondary-color: #00CBFF;
  --tg-white: #ffffff;
  --tg-black-two: #160042;
  --tg-body-font-color: #C8B8E8;
  --tg-heading-font-color: #FFFFFF;

  /* Gradients */
  --tg-gradient-color: linear-gradient(89.78deg, #C8BDFF -31.69%, #BAA6FF -22.78%, #6721FF 27.93%, #00CBFF 99.79%);
}
```

### Banner Title (H2 Heading)

**Font:** Plus Jakarta Sans (heading font)
**Text:** "Whatever You want to ask- DEX.AI has the Answers"

```css
.banner-content .title {
  font-size: 70px;
  font-family: var(--tg-heading-font-family); /* Plus Jakarta Sans */
  font-weight: 700;
  color: var(--tg-heading-font-color); /* #FFFFFF */
  letter-spacing: -0.01em;
  line-height: 1.2;
  width: 90%;
  margin: 0 auto 30px;
  text-align: center;
}
```

### Gradient Text Effect (Typewriter Words)

The animated words "Answers" and "Solutions" use a gradient effect:

```css
.banner-content .ah-headline span.ah-words-wrapper {
  background: linear-gradient(89.78deg, #C8BDFF -31.69%, #BAA6FF -22.78%, #6721FF 27.93%, #00CBFF 99.79%);
  -webkit-text-fill-color: transparent;
  -webkit-background-clip: text;
  background-clip: text;
  font-weight: 300; /* Lighter weight for gradient text */
}
```

### Banner Paragraph

```css
.banner-content p {
  font-size: 18px;
  font-family: var(--tg-body-font-family); /* Outfit */
  color: var(--tg-body-font-color); /* #C8B8E8 */
  width: 60%;
  margin: 0 auto 40px;
  line-height: 1.75;
}
```

---

## Button Styles

### Base Button Styles (.btn)

Used for the **"SIGN IN"** button in the header.

```css
.btn {
  /* User interaction */
  user-select: none;
  -moz-user-select: none;
  cursor: pointer;

  /* Visual */
  background: var(--tg-primary-color); /* #6721FF */
  border: medium none;
  border-radius: 30px;
  color: var(--tg-white);

  /* Typography */
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.05em;
  line-height: 1;
  text-align: center;
  text-transform: uppercase;

  /* Spacing */
  padding: 19px 30px;
  margin-bottom: 0;

  /* Layout */
  display: inline-block;
  vertical-align: middle;
  white-space: nowrap;

  /* Animation */
  transition: all 0.3s ease 0s;
  touch-action: manipulation;

  /* Positioning for effects */
  position: relative;
  z-index: 1;
  overflow: hidden;
}
```

### Button Hover Effect - Circular Reveal

```css
.btn::before {
  content: "";
  position: absolute;

  /* Circle positioning */
  width: 200%;
  height: 200%;
  top: 110%; /* Hidden below button */
  left: 50%;

  /* Styling */
  background: var(--tg-secondary-color); /* #00CBFF */
  border-radius: 50%;

  /* Transform */
  -webkit-transform: translateX(-50%);
  transform: translateX(-50%);

  /* Animation */
  -webkit-transition-duration: 800ms;
  transition-duration: 800ms;

  z-index: -1;
}

.btn:hover::before {
  top: -40%; /* Moves up to reveal cyan background */
}
```

### Button Arrow Icon

```css
.btn::after {
  content: "\f061"; /* Font Awesome arrow-right icon code */
  margin-left: 20px;
  transform: rotate(-45deg); /* Diagonal arrow */
  transition: all 0.3s ease 0s;
  font-weight: 400;
  font-family: "Font Awesome 5 Pro";
  display: inline-block;
}

.btn:hover::after {
  transform: rotate(0); /* Arrow straightens on hover */
}

.btn:hover {
  color: var(--tg-white);
}
```

---

## Gradient Buttons (.gradient-btn)

Used for **"START A FREE TRIAL"** and **"HOW DEX.AI WORK"** buttons.

### Standard Gradient Button

```css
.gradient-btn {
  /* Inherits most styles, main differences: */
  user-select: none;
  -moz-user-select: none;

  /* Main gradient background */
  background-image: var(--tg-gradient-color);
  /* linear-gradient(89.78deg, #C8BDFF -31.69%, #BAA6FF -22.78%, #6721FF 27.93%, #00CBFF 99.79%) */

  border: medium none;
  border-radius: 30px;
  color: var(--tg-white);
  cursor: pointer;

  /* Typography */
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.05em;
  line-height: 1;
  text-transform: uppercase;
  text-align: center;

  /* Spacing */
  padding: 19px 30px;
  margin-bottom: 0;

  /* Layout */
  display: inline-block;
  vertical-align: middle;
  white-space: nowrap;

  /* Animation */
  transition: all 0.3s ease 0s;
  touch-action: manipulation;

  /* Positioning */
  position: relative;
  z-index: 1;
}
```

### Gradient Button Hover Effect

```css
.gradient-btn::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;

  /* Reversed gradient for hover */
  background: linear-gradient(267deg, #6721FF 27.93%, #00CBFF 99.79%, #C8BDFF -31.69%, #BAA6FF -22.78%);

  border-radius: 30px;
  opacity: 0;
  transition: all 0.5s ease;
  z-index: -1;
}

.gradient-btn:hover::before {
  opacity: 1; /* Reveals reversed gradient */
}
```

### Gradient Button Arrow Icon

```css
.gradient-btn::after {
  content: "\f061"; /* Font Awesome arrow-right */
  margin-left: 20px;
  transform: rotate(-45deg);
  transition: all 0.3s ease 0s;
  font-weight: 400;
  font-family: "Font Awesome 5 Pro";
  display: inline-block;
}

.gradient-btn:hover::after {
  transform: rotate(0);
}

.gradient-btn:hover {
  color: var(--tg-white);
}
```

---

## Gradient Button Two (.gradient-btn-two)

Used for **"HOW DEX.AI WORK"** - outlined gradient button.

### Outlined Gradient Button

```css
.gradient-btn.gradient-btn-two::before {
  content: "";
  position: absolute;

  /* Creates inner "hole" effect */
  left: 2px;
  right: 2px;
  bottom: 2px;
  top: 2px;

  border-radius: 30px;
  background: var(--tg-black-two); /* #160042 - dark background */
  opacity: 1;
  width: auto;
  height: auto;
  transition: all 0.3s ease 0s;
}

.gradient-btn.gradient-btn-two:hover::before {
  opacity: 0; /* Reveals full gradient on hover */
}
```

**Note:** The `gradient-btn-two` still has the arrow icon from the base `.gradient-btn::after` rule.

---

## Icon System

### Font Awesome 5 Pro

The arrow icons use **Font Awesome 5 Pro**.

#### Installation

```html
<!-- Add to your HTML head -->
<link rel="stylesheet" href="https://pro.fontawesome.com/releases/v5.15.4/css/all.css">
```

Or use the free version:

```html
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css">
```

#### Arrow Icon Unicode

- **Arrow Right:** `\f061`
- Font Family: `"Font Awesome 5 Pro"` (or `"Font Awesome 5 Free"`)

---

## Complete Code Examples

### HTML Structure

```jsx
import { Link } from 'react-router-dom';

// Banner Buttons
<div className="banner-btn">
  <Link to="/login" className="gradient-btn">
    start a free trial
  </Link>
  <Link to="/work" className="gradient-btn gradient-btn-two">
    how dex.ai work
  </Link>
</div>

// Header Sign In Button
<button onClick={onLoginClick} className="btn">
  sign in
</button>
```

### Button Container

```css
.banner-content .banner-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px 30px; /* 10px vertical, 30px horizontal gap */
}
```

---

## Complete CSS Bundle

Here's everything you need in one place:

```css
/* Import Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100;200;300;400;500;600;700&family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400;1,500;1,600;1,700;1,800&display=swap');

/* CSS Variables */
:root {
  --tg-body-font-family: 'Outfit', sans-serif;
  --tg-heading-font-family: 'Plus Jakarta Sans', sans-serif;
  --tg-primary-color: #6721FF;
  --tg-secondary-color: #00CBFF;
  --tg-white: #ffffff;
  --tg-black-two: #160042;
  --tg-heading-font-color: #FFFFFF;
  --tg-body-font-color: #C8B8E8;
  --tg-gradient-color: linear-gradient(89.78deg, #C8BDFF -31.69%, #BAA6FF -22.78%, #6721FF 27.93%, #00CBFF 99.79%);
}

/* Banner Title */
.banner-content .title {
  font-size: 70px;
  font-family: var(--tg-heading-font-family);
  font-weight: 700;
  color: var(--tg-heading-font-color);
  letter-spacing: -0.01em;
  line-height: 1.2;
  width: 90%;
  margin: 0 auto 30px;
  text-align: center;
}

/* Gradient Text (Typewriter) */
.banner-content .ah-headline span.ah-words-wrapper {
  background: var(--tg-gradient-color);
  -webkit-text-fill-color: transparent;
  -webkit-background-clip: text;
  background-clip: text;
  font-weight: 300;
}

/* Banner Paragraph */
.banner-content p {
  font-size: 18px;
  font-family: var(--tg-body-font-family);
  color: var(--tg-body-font-color);
  width: 60%;
  margin: 0 auto 40px;
  line-height: 1.75;
}

/* Button Container */
.banner-content .banner-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px 30px;
}

/* Base Button (.btn) - Used for "SIGN IN" */
.btn {
  user-select: none;
  -moz-user-select: none;
  background: var(--tg-primary-color);
  border: medium none;
  border-radius: 30px;
  color: var(--tg-white);
  cursor: pointer;
  display: inline-block;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.05em;
  line-height: 1;
  margin-bottom: 0;
  padding: 19px 30px;
  text-align: center;
  text-transform: uppercase;
  touch-action: manipulation;
  transition: all 0.3s ease 0s;
  vertical-align: middle;
  white-space: nowrap;
  position: relative;
  z-index: 1;
  overflow: hidden;
}

.btn::before {
  content: "";
  position: absolute;
  transition-duration: 800ms;
  width: 200%;
  height: 200%;
  top: 110%;
  left: 50%;
  background: var(--tg-secondary-color);
  transform: translateX(-50%);
  border-radius: 50%;
  z-index: -1;
}

.btn:hover::before {
  top: -40%;
}

.btn::after {
  content: "\f061";
  margin-left: 20px;
  transform: rotate(-45deg);
  transition: all 0.3s ease 0s;
  font-weight: 400;
  font-family: "Font Awesome 5 Pro";
  display: inline-block;
}

.btn:hover::after {
  transform: rotate(0);
}

.btn:hover {
  color: var(--tg-white);
}

/* Gradient Button - Used for "START A FREE TRIAL" */
.gradient-btn {
  user-select: none;
  -moz-user-select: none;
  background-image: var(--tg-gradient-color);
  border: medium none;
  border-radius: 30px;
  color: var(--tg-white);
  cursor: pointer;
  display: inline-block;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.05em;
  line-height: 1;
  margin-bottom: 0;
  padding: 19px 30px;
  text-align: center;
  text-transform: uppercase;
  touch-action: manipulation;
  transition: all 0.3s ease 0s;
  vertical-align: middle;
  white-space: nowrap;
  position: relative;
  z-index: 1;
}

.gradient-btn::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(267deg, #6721FF 27.93%, #00CBFF 99.79%, #C8BDFF -31.69%, #BAA6FF -22.78%);
  border-radius: 30px;
  opacity: 0;
  transition: all 0.5s ease;
  z-index: -1;
}

.gradient-btn:hover::before {
  opacity: 1;
}

.gradient-btn::after {
  content: "\f061";
  margin-left: 20px;
  transform: rotate(-45deg);
  transition: all 0.3s ease 0s;
  font-weight: 400;
  font-family: "Font Awesome 5 Pro";
  display: inline-block;
}

.gradient-btn:hover::after {
  transform: rotate(0);
}

.gradient-btn:hover {
  color: var(--tg-white);
}

/* Gradient Button Two - Used for "HOW DEX.AI WORK" */
.gradient-btn.gradient-btn-two::before {
  content: "";
  position: absolute;
  left: 2px;
  right: 2px;
  bottom: 2px;
  top: 2px;
  border-radius: 30px;
  background: var(--tg-black-two);
  opacity: 1;
  width: auto;
  height: auto;
  transition: all 0.3s ease 0s;
}

.gradient-btn.gradient-btn-two:hover::before {
  opacity: 0;
}
```

---

## Quick Reference Table

| Button Type | Class Names | Used For | Background | Hover Effect | Arrow Icon |
|------------|-------------|----------|------------|--------------|------------|
| **Standard Button** | `.btn` | "SIGN IN" | Solid Purple (#6721FF) | Cyan circle reveals from bottom | Yes, rotates from -45deg to 0deg |
| **Gradient Button** | `.gradient-btn` | "START A FREE TRIAL" | Purple to Cyan Gradient | Reversed gradient fades in | Yes, rotates from -45deg to 0deg |
| **Outlined Gradient** | `.gradient-btn.gradient-btn-two` | "HOW DEX.AI WORK" | Gradient border with dark fill | Dark fill fades out | Yes, rotates from -45deg to 0deg |

---

## Font Summary

| Element | Font Family | Font Weight | Font Size | Color |
|---------|-------------|-------------|-----------|-------|
| **Main Heading** | Plus Jakarta Sans | 700 (Bold) | 70px | White (#FFFFFF) |
| **Gradient Text** | Plus Jakarta Sans | 300 (Light) | 70px | Purple-Cyan Gradient |
| **Paragraph** | Outfit | 400 (Regular) | 18px | Light Purple (#C8B8E8) |
| **Buttons** | Outfit (inherited) | 600 (Semi-Bold) | 14px | White (#FFFFFF) |

---

## Animation Details

### Arrow Icon Animation

1. **Default State:** Rotated -45 degrees (diagonal)
2. **Hover State:** Rotates to 0 degrees (horizontal)
3. **Transition:** 0.3s ease

### Button Hover Animations

#### Standard Button (.btn)
- **Effect:** Circular cyan background reveals from bottom
- **Duration:** 800ms
- **Easing:** Default

#### Gradient Button (.gradient-btn)
- **Effect:** Reversed gradient fades in
- **Duration:** 500ms
- **Easing:** Ease

#### Outlined Gradient (.gradient-btn-two)
- **Effect:** Dark center fades out, revealing full gradient
- **Duration:** 300ms
- **Easing:** Ease

---

## Responsive Considerations

For mobile/smaller screens, you may want to adjust:

```css
@media (max-width: 768px) {
  .banner-content .title {
    font-size: 40px; /* Smaller heading */
    width: 100%;
  }

  .banner-content p {
    width: 90%;
    font-size: 16px;
  }

  .banner-content .banner-btn {
    flex-direction: column; /* Stack buttons vertically */
    gap: 15px;
  }

  .btn,
  .gradient-btn {
    width: 100%; /* Full width on mobile */
    padding: 16px 24px;
  }
}
```

---

## Implementation Checklist

- [ ] Import Google Fonts (Outfit, Plus Jakarta Sans)
- [ ] Install Font Awesome 5 Pro (or Free version)
- [ ] Add CSS variables to :root
- [ ] Copy button styles (.btn, .gradient-btn, .gradient-btn-two)
- [ ] Add button hover effects (::before pseudo-elements)
- [ ] Add arrow icon styles (::after pseudo-elements)
- [ ] Set up banner title and paragraph styles
- [ ] Configure gradient text effect for typewriter
- [ ] Test hover animations
- [ ] Test responsive behavior

---

## Notes

1. **Font Awesome:** The arrow icon uses Font Awesome 5 Pro. If you don't have Pro, use the free version and change the font-family to `"Font Awesome 5 Free"`.

2. **Z-Index Layering:** Buttons use `z-index: 1` with pseudo-elements at `z-index: -1` to create layered hover effects.

3. **Gradient Direction:** The hover gradient is reversed (267deg vs 89.78deg) to create a smooth color shift effect.

4. **Text Transform:** All buttons use `text-transform: uppercase` - the text "start a free trial" becomes "START A FREE TRIAL".

5. **Overflow Hidden:** The `.btn` class uses `overflow: hidden` to clip the circular hover effect.

---

## Color Palette Quick Reference

```css
Purple (Primary):    #6721FF
Cyan (Secondary):    #00CBFF
Dark Purple BG:      #160042
White:               #FFFFFF
Light Purple Text:   #C8B8E8

Gradient Colors:
  - Light Purple:    #C8BDFF
  - Purple:          #BAA6FF
  - Main Purple:     #6721FF
  - Cyan:            #00CBFF
```
