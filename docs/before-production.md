1)  Node Version must be compatible with netlify cli / npm
  Your app is an Electron desktop app, not a CLI tool. For production:
  - Bundle Node.js with Electron (already included)
  - Don't use system Node.js - you're currently spawning npm/netlify commands that use system Node
  - Better approach: Use Electron's bundled Node.js or package everything needed


2) 