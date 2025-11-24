# Recreating the HomeOne Background Effect

This guide shows you how to recreate the layered background effect used in the HomeOne page.

## Overview

The effect consists of three main layers:
1. **Fixed Shape Background** - A shape that follows the viewport (`main_shape.png`)
2. **Noise Texture Overlay** - A noise texture with blend mode (`noise_bg.png`)
3. **SVG Gradient Shapes** - Animated gradient paths behind content sections

---

## 1. Required Assets

You'll need these image files from `/public/assets/img/`:

- `/assets/img/images/main_shape.png` - The main decorative shape
- `/assets/img/bg/noise_bg.png` - The noise texture overlay

---

## 2. CSS Setup

### CSS Variables (Add to your root styles)

```css
:root {
  --tg-primary-color: #6721FF;
  --tg-secondary-color: #00CBFF;
  --tg-black-two: #160042;
  --tg-body-font-color: #C8B8E8;
  --tg-heading-font-color: #FFFFFF;
}

body {
  background-color: var(--tg-black-two);
  color: var(--tg-body-font-color);
}
```

### Main Content Container Styles

```css
main.main-content {
  position: relative;
  z-index: 1;
  background-color: var(--tg-black-two);
}

/* Fixed shape that follows viewport */
.main-shape {
  left: 0;
  top: 0;
  position: fixed;
  background-position: center;
  background-size: cover;
  width: 100%;
  height: 100%;
  z-index: -1;
}

/* Noise texture overlay */
.noise-bg {
  background-size: cover;
  background-position: center;
  width: 100%;
  height: 100%;
  position: absolute;
  left: 0;
  top: 0;
  z-index: -1;
  mix-blend-mode: soft-light;
  opacity: 0.7;
}
```

---

## 3. React Layout Component

Create a `Layout.jsx` component:

```jsx
import { useEffect } from "react";

const Layout = ({ children, mainCls }) => {
  return (
    <>
      <DataBg />

      <main className={mainCls ? mainCls : "main-content"}>
        {/* Noise texture overlay */}
        <div
          className="noise-bg"
          data-background="/assets/img/bg/noise_bg.png"
        />

        {/* Fixed shape background */}
        <div
          className="main-shape"
          data-background="/assets/img/images/main_shape.png"
        />

        {children}
      </main>
    </>
  );
};

export default Layout;
```

---

## 4. DataBg Component (Background Image Handler)

Create a `DataBg.jsx` component to handle `data-background` attributes:

```jsx
import { useEffect } from "react";

const DataBg = () => {
  useEffect(() => {
    const elements = document.querySelectorAll("[data-background]");

    elements.forEach((element) => {
      const bgUrl = element.getAttribute("data-background");
      if (bgUrl) {
        element.style.backgroundImage = `url(${bgUrl})`;
      }
    });
  }, []);

  return null;
};

export default DataBg;
```

---

## 5. SVG Gradient Shape (For Video Section)

Add this SVG gradient shape behind content sections:

```jsx
const VideoSection = () => {
  return (
    <div className="video-area">
      {/* SVG Gradient Shape */}
      <div className="video-shape">
        <svg
          height={1192}
          viewBox="0 0 1920 1192"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            stroke="url(#paint0_linear_2840_46)"
            strokeWidth={7}
            strokeDasharray="10 10"
            d="M-40.9996 902C-8.39405 961.001 87.0357 1262.13 234 1171.5C385.21 1078.25 424.961 618.039 479.564 680.288C534.166 742.538 625.164 842.979 735.172 706.451C845.181 569.923 839.697 412.37 1093.03 631.043C1346.36 849.717 1371.47 413.985 1477.97 274.534C1584.48 135.083 1738.61 381.41 1830.32 343.155C1922.04 304.9 1862.93 -74.0337 2236.96 18.2495"
          />
          <defs>
            <linearGradient
              id="paint0_linear_2840_46"
              x1="2117.79"
              y1="34.1404"
              x2="83.2194"
              y2="768.35"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset={0} stopColor="rgba(200, 189, 255)" />
              <stop offset="0.13824" stopColor="#BAA6FF" />
              <stop offset="0.337481" stopColor="#6721FF" />
              <stop offset="0.900573" stopColor="#180048" />
              <stop offset={1} stopColor="#00CBFF" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="container">
        {/* Your video content here */}
      </div>
    </div>
  );
};
```

### CSS for SVG Shape

```css
.video-area {
  position: relative;
  padding: 100px 0;
}

.video-shape {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
  overflow: hidden;
}

.video-shape svg {
  position: absolute;
  left: 0;
  bottom: -100px;
  width: 100%;
  right: 0;
  z-index: -1;
}
```

---

## 6. Complete Usage Example

```jsx
import Layout from './components/Layout';
import VideoSection from './components/VideoSection';
import './styles/background-effect.css';

function App() {
  return (
    <Layout mainCls="main-content">
      <section className="banner-area">
        <h1>Your Banner Content</h1>
      </section>

      <VideoSection />

      <section className="other-content">
        <h2>More Content</h2>
      </section>
    </Layout>
  );
}

export default App;
```

---

## 7. Key Points

### Layer Order (Z-Index)
- `main-shape`: `z-index: -1` (fixed, follows scroll)
- `noise-bg`: `z-index: -1` (absolute within main content)
- `main-content`: `z-index: 1` (contains all page content)
- SVG shapes: `z-index: -1` (within their sections)

### Visual Effects Applied
1. **Noise texture** uses `mix-blend-mode: soft-light` and `opacity: 0.7`
2. **Fixed positioning** on `main-shape` creates parallax effect
3. **SVG gradients** add dynamic visual interest
4. **Dashed stroke** on SVG path creates dotted line effect

### Performance Tips
- Use optimized PNG files (compress images)
- Consider using CSS background-image instead of data-background for better performance
- Lazy load the DataBg component if needed

---

## 8. Alternative: Direct CSS Background Images

If you prefer not to use the `data-background` attribute system:

```css
.main-shape {
  left: 0;
  top: 0;
  position: fixed;
  background-image: url('/assets/img/images/main_shape.png');
  background-position: center;
  background-size: cover;
  width: 100%;
  height: 100%;
  z-index: -1;
}

.noise-bg {
  background-image: url('/assets/img/bg/noise_bg.png');
  background-size: cover;
  background-position: center;
  width: 100%;
  height: 100%;
  position: absolute;
  left: 0;
  top: 0;
  z-index: -1;
  mix-blend-mode: soft-light;
  opacity: 0.7;
}
```

And simplify your JSX:

```jsx
<main className="main-content">
  <div className="noise-bg" />
  <div className="main-shape" />
  {children}
</main>
```

---

## 9. Customization Options

### Change Colors
Modify the CSS variables in `:root` to match your brand:

```css
:root {
  --tg-primary-color: #YOUR_COLOR;
  --tg-secondary-color: #YOUR_COLOR;
  --tg-black-two: #YOUR_BG_COLOR;
}
```

### Adjust Noise Intensity
Change the `opacity` value:

```css
.noise-bg {
  opacity: 0.5; /* Lower = less visible, Higher = more visible */
}
```

### Change Blend Mode
Try different blend modes:

```css
.noise-bg {
  mix-blend-mode: overlay; /* or multiply, screen, etc. */
}
```

---

## 10. Assets Checklist

- [ ] `main_shape.png` - placed in `/public/assets/img/images/`
- [ ] `noise_bg.png` - placed in `/public/assets/img/bg/`
- [ ] CSS variables defined
- [ ] Layout component created
- [ ] DataBg component created (if using data-background approach)
- [ ] CSS styles imported
- [ ] SVG gradient shapes added to sections

---

## Result

You should now have:
- A fixed decorative shape that follows the viewport
- A noise texture overlay with soft-light blend
- SVG gradient shapes for dynamic visual interest
- A dark purple background (#160042)
- All layers properly stacked with correct z-index values
