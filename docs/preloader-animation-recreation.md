# Preloader Animation Recreation Guide

Complete guide to recreating the white loading animation that appears when you first load the page.

---

## Table of Contents

1. [Overview](#overview)
2. [Component Structure](#component-structure)
3. [CSS Animation](#css-animation)
4. [React Implementation](#react-implementation)
5. [Complete Code](#complete-code)

---

## Overview

The preloader is a **5-bar vertical stretching animation** with white bars on a dark purple background. Each bar animates in sequence, creating a wave-like effect.

### Animation Characteristics:
- **Style:** 5 vertical white bars
- **Background:** Dark purple (#160042)
- **Animation:** Bars stretch vertically (scaleY) in sequence
- **Duration:** 1.2 seconds per cycle (infinite loop)
- **Display Time:** Shows for 1 second on page load
- **Position:** Full-screen, centered

---

## Component Structure

### Preloader.jsx

```jsx
import React from "react";
import "./preloader.css";

const Preloader = () => {
  return (
    <div id="preloader">
      <div className="spinner">
        <div className="rect1" />
        <div className="rect2" />
        <div className="rect3" />
        <div className="rect4" />
        <div className="rect5" />
      </div>
    </div>
  );
}

export default Preloader;
```

---

## CSS Animation

### Complete preloader.css

```css
/*=============================
 Preloader
===============================*/
#preloader {
  position: fixed;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--tg-black-two); /* #160042 */
  z-index: 999;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
}

.spinner {
  margin: 100px auto;
  width: 50px;
  height: 40px;
  text-align: center;
  font-size: 10px;
}

.spinner > div {
  background-color: var(--tg-white); /* #FFFFFF */
  height: 100%;
  width: 6px;
  display: inline-block;
  -webkit-animation: sk-stretchdelay 1.2s infinite ease-in-out;
  animation: sk-stretchdelay 1.2s infinite ease-in-out;
}

.spinner .rect2 {
  -webkit-animation-delay: -1.1s;
  animation-delay: -1.1s;
  margin: 0px 2px;
}

.spinner .rect3 {
  -webkit-animation-delay: -1.0s;
  animation-delay: -1.0s;
  margin-right: 2px;
}

.spinner .rect4 {
  -webkit-animation-delay: -0.9s;
  animation-delay: -0.9s;
  margin-right: 2px;
}

.spinner .rect5 {
  -webkit-animation-delay: -0.8s;
  animation-delay: -0.8s;
}

/* Webkit Animation */
@-webkit-keyframes sk-stretchdelay {
  0%,
  40%,
  100% {
    -webkit-transform: scaleY(0.4);
  }

  20% {
    -webkit-transform: scaleY(1.0);
  }
}

/* Standard Animation */
@keyframes sk-stretchdelay {
  0%,
  40%,
  100% {
    transform: scaleY(0.4);
    -webkit-transform: scaleY(0.4);
  }

  20% {
    transform: scaleY(1.0);
    -webkit-transform: scaleY(1.0);
  }
}
```

### CSS Variables Required

```css
:root {
  --tg-white: #ffffff;
  --tg-black-two: #160042;
}
```

---

## React Implementation

### App.jsx Integration

```jsx
import { useEffect, useState } from "react";
import Preloader from "./components/preloader/Preloader.jsx";
import AOS from "aos";
import "aos/dist/aos.css";

function App() {
  const [loading, setLoading] = useState(true);

  // Initialize AOS and remove preloader
  useEffect(() => {
    AOS.init({
      duration: 2000,
    });

    // Hide preloader after 1 second
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  }, []);

  return (
    <>
      {!loading ? (
        {/* Your main app content here */}
        <div>Your App Content</div>
      ) : (
        <Preloader />
      )}
    </>
  );
}

export default App;
```

---

## Complete Code

### File Structure

```
src/
├── components/
│   └── preloader/
│       ├── Preloader.jsx
│       └── preloader.css
└── App.jsx
```

### Preloader.jsx (Full)

```jsx
import React from "react";
import "./preloader.css";

const Preloader = () => {
  return (
    <div id="preloader">
      <div className="spinner">
        <div className="rect1" />
        <div className="rect2" />
        <div className="rect3" />
        <div className="rect4" />
        <div className="rect5" />
      </div>
    </div>
  );
}

export default Preloader;
```

### preloader.css (Full)

```css
/*=============================
 Preloader
===============================*/
#preloader {
  position: fixed;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--tg-black-two);
  z-index: 999;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
}

.spinner {
  margin: 100px auto;
  width: 50px;
  height: 40px;
  text-align: center;
  font-size: 10px;
}

.spinner > div {
  background-color: var(--tg-white);
  height: 100%;
  width: 6px;
  display: inline-block;
  -webkit-animation: sk-stretchdelay 1.2s infinite ease-in-out;
  animation: sk-stretchdelay 1.2s infinite ease-in-out;
}

.spinner .rect2 {
  -webkit-animation-delay: -1.1s;
  animation-delay: -1.1s;
  margin: 0px 2px;
}

.spinner .rect3 {
  -webkit-animation-delay: -1.0s;
  animation-delay: -1.0s;
  margin-right: 2px;
}

.spinner .rect4 {
  -webkit-animation-delay: -0.9s;
  animation-delay: -0.9s;
  margin-right: 2px;
}

.spinner .rect5 {
  -webkit-animation-delay: -0.8s;
  animation-delay: -0.8s;
}

@-webkit-keyframes sk-stretchdelay {
  0%,
  40%,
  100% {
    -webkit-transform: scaleY(0.4);
  }

  20% {
    -webkit-transform: scaleY(1.0);
  }
}

@keyframes sk-stretchdelay {
  0%,
  40%,
  100% {
    transform: scaleY(0.4);
    -webkit-transform: scaleY(0.4);
  }

  20% {
    transform: scaleY(1.0);
    -webkit-transform: scaleY(1.0);
  }
}
```

---

## Animation Breakdown

### Timeline

| Bar | Animation Delay | Start Time |
|-----|----------------|------------|
| rect1 | 0s | 0.0s |
| rect2 | -1.1s | 0.1s |
| rect3 | -1.0s | 0.2s |
| rect4 | -0.9s | 0.3s |
| rect5 | -0.8s | 0.4s |

### Keyframe Explanation

```css
0%    → scaleY(0.4) - Bar is at 40% height (compressed)
20%   → scaleY(1.0) - Bar is at 100% height (stretched)
40%   → scaleY(0.4) - Bar returns to 40% height
100%  → scaleY(0.4) - Bar stays at 40% height until next cycle
```

### Visual Representation

```
Time:  0%     20%    40%    100%
      ____    ████   ____   ____
      ____    ████   ____   ____
      ____    ████   ____   ____
      ____    ████   ____   ____
      ____    ████   ____   ____
     (40%)   (100%)  (40%)  (40%)
```

---

## Customization Options

### Change Colors

```css
/* Change background color */
#preloader {
  background: #000000; /* Black instead of purple */
}

/* Change bar color */
.spinner > div {
  background-color: #6721FF; /* Purple instead of white */
}
```

### Adjust Animation Speed

```css
/* Faster animation (0.8s instead of 1.2s) */
.spinner > div {
  animation: sk-stretchdelay 0.8s infinite ease-in-out;
}

/* Slower animation (2s instead of 1.2s) */
.spinner > div {
  animation: sk-stretchdelay 2s infinite ease-in-out;
}
```

### Change Bar Count

Add or remove bars:

```jsx
// Add a 6th bar
<div className="spinner">
  <div className="rect1" />
  <div className="rect2" />
  <div className="rect3" />
  <div className="rect4" />
  <div className="rect5" />
  <div className="rect6" />
</div>
```

```css
/* Add corresponding CSS */
.spinner .rect6 {
  animation-delay: -0.7s;
}
```

### Change Display Duration

```jsx
// Show for 2 seconds instead of 1
setTimeout(() => {
  setLoading(false);
}, 2000);

// Show for 0.5 seconds
setTimeout(() => {
  setLoading(false);
}, 500);
```

### Change Bar Width/Height

```css
.spinner {
  width: 80px; /* Wider spinner (from 50px) */
  height: 60px; /* Taller spinner (from 40px) */
}

.spinner > div {
  width: 10px; /* Wider bars (from 6px) */
}
```

---

## Alternative Preloader Styles

### Circular Spinner

```jsx
const Preloader = () => {
  return (
    <div id="preloader">
      <div className="circular-spinner"></div>
    </div>
  );
}
```

```css
.circular-spinner {
  border: 4px solid rgba(255, 255, 255, 0.1);
  border-top: 4px solid #ffffff;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
```

### Gradient Spinner

```css
.spinner > div {
  background: linear-gradient(89.78deg, #C8BDFF -31.69%, #BAA6FF -22.78%, #6721FF 27.93%, #00CBFF 99.79%);
}
```

### Pulsing Dots

```jsx
const Preloader = () => {
  return (
    <div id="preloader">
      <div className="dots-spinner">
        <div className="dot"></div>
        <div className="dot"></div>
        <div className="dot"></div>
      </div>
    </div>
  );
}
```

```css
.dots-spinner {
  display: flex;
  gap: 10px;
}

.dot {
  width: 15px;
  height: 15px;
  background: #ffffff;
  border-radius: 50%;
  animation: pulse 1.4s ease-in-out infinite;
}

.dot:nth-child(1) { animation-delay: -0.32s; }
.dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes pulse {
  0%, 80%, 100% {
    transform: scale(0);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}
```

---

## Browser Compatibility

The preloader uses:
- CSS Transforms (scaleY)
- CSS Animations
- Flexbox

**Supported Browsers:**
- Chrome 36+
- Firefox 16+
- Safari 9+
- Edge 12+
- Opera 23+
- Mobile browsers (iOS Safari 9+, Chrome Android)

**Fallbacks:**
- `-webkit-` prefixes included for older browsers
- Works on IE11+ (with some limitations)

---

## Performance Tips

1. **Use `will-change`** for better animation performance:
```css
.spinner > div {
  will-change: transform;
}
```

2. **Avoid complex backgrounds** during preload
3. **Keep timeout reasonable** (1-2 seconds max)
4. **Use `transform` instead of `height`** for smoother animations (already implemented)

---

## Accessibility Considerations

Add ARIA attributes for screen readers:

```jsx
const Preloader = () => {
  return (
    <div
      id="preloader"
      role="status"
      aria-live="polite"
      aria-label="Loading content"
    >
      <div className="spinner">
        <div className="rect1" />
        <div className="rect2" />
        <div className="rect3" />
        <div className="rect4" />
        <div className="rect5" />
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  );
}
```

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

---

## Implementation Checklist

- [ ] Create `components/preloader/` folder
- [ ] Create `Preloader.jsx` component
- [ ] Create `preloader.css` stylesheet
- [ ] Add CSS variables (--tg-white, --tg-black-two)
- [ ] Import Preloader in App.jsx
- [ ] Add loading state to App.jsx
- [ ] Set up setTimeout to hide preloader
- [ ] Test preloader appears on page load
- [ ] Test preloader disappears after 1 second
- [ ] Verify animation is smooth
- [ ] Test on different browsers
- [ ] Add accessibility attributes (optional)

---

## Common Issues & Solutions

### Preloader doesn't show
**Issue:** Preloader briefly flashes or doesn't appear
**Solution:** Check that `loading` state is initialized to `true`
```jsx
const [loading, setLoading] = useState(true); // ✅ Correct
const [loading, setLoading] = useState(false); // ❌ Wrong
```

### Animation doesn't work
**Issue:** Bars are static, no animation
**Solution:** Verify `preloader.css` is imported in component
```jsx
import "./preloader.css"; // ✅ Must be imported
```

### Preloader never disappears
**Issue:** Page stays on loading screen
**Solution:** Check setTimeout is being called
```jsx
useEffect(() => {
  setTimeout(() => {
    setLoading(false);
  }, 1000);
}, []); // ✅ Empty dependency array
```

### White bars not visible
**Issue:** Bars blend into background
**Solution:** Verify CSS variables are defined
```css
:root {
  --tg-white: #ffffff;
  --tg-black-two: #160042;
}
```

---

## Quick Reference

### Key CSS Properties

| Property | Value | Purpose |
|----------|-------|---------|
| `position` | `fixed` | Full-screen overlay |
| `z-index` | `999` | Appears above all content |
| `display` | `flex` | Centers spinner |
| `animation` | `sk-stretchdelay 1.2s` | Bar stretching effect |
| `animation-delay` | `-0.8s to -1.1s` | Sequential timing |
| `scaleY()` | `0.4 to 1.0` | Vertical stretching |

### Key React States

```jsx
const [loading, setLoading] = useState(true);  // Initial: true
setTimeout(() => setLoading(false), 1000);     // After: 1 second
```

### Animation Timing

- **Duration:** 1.2 seconds per cycle
- **Display Time:** 1 second total
- **Delay Between Bars:** 0.1 seconds

---

## Summary

The preloader is a simple yet effective loading animation consisting of:
- **5 white vertical bars** on a dark purple background
- **Sequential stretching animation** (scaleY from 0.4 to 1.0)
- **1 second display time** on initial page load
- **Full-screen fixed overlay** with high z-index
- **Smooth CSS animations** with browser prefixes

It provides visual feedback during app initialization and creates a professional user experience.
