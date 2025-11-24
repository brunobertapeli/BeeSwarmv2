# Interactive XML Highlight System

## Overview

The Interactive XML Highlight system detects and renders XML-style tags in Claude's messages as clickable, animated elements that trigger specific actions in the application.

## Architecture

### Core Component

**`InteractiveXMLHighlight.tsx`**
- Detects XML tags using regex: `/<(\w+)>(.*?)<\/\1>/g`
- Renders tags with gradient backgrounds and animations
- Provides callbacks for click and detection events

```typescript
interface InteractiveXMLHighlightProps {
  text: string
  onXMLClick?: (tag: string, content: string) => void
  onXMLDetected?: (tag: string, content: string) => void
}
```

### Integration Points

1. **StatusSheet.tsx** - Renders InteractiveXMLHighlight for assistant messages
2. **ActionBar.tsx** - Handles tag click actions and detection events
3. **ProjectView.tsx** - Manages settings modal opening with specific tabs

## Supported Tags

### `<env>` Tag

**Visual Style:**
- Gradient: Blue → Purple → Pink
- Icon: Settings gear
- Arrow indicator on right

**Behavior:**
- **On Detection**: Updates badge count on Settings icon showing empty environment variables
- **On Click**: Opens Project Settings modal at Environment Variables tab
- **Badge**: Yellow badge showing count of empty env vars (e.g., "2")

**Example:**
```
Check your <env>Project Settings > Environment Variables</env>
```

### `<editmode>` Tag

**Visual Style:**
- Gradient: Pink
- No left icon
- Keyboard badge showing "E"
- Tooltip on hover: "Press E to activate Edit Mode"

**Behavior:**
- **On Click**:
  - Enables Edit Mode
  - Collapses StatusSheet
  - Shows toast notification

**Example:**
```
<editmode>Click here to activate Edit Mode</editmode>
```

## Visual Features

### Animations
- **Continuous Sweep**: Black gradient sweep running across text (4s duration)
- **Always Visible**: Animations run continuously, not just on hover

### Styling
- Border with white opacity
- Backdrop blur effect
- Rounded corners
- White text with shadow on hover (env tags only)
- Tag-specific gradient colors

## Adding New Tags

To add a new XML tag type:

1. **Add gradient in `getGradientForTag()`:**
```typescript
case 'newtag':
  return 'from-color-500/30 via-color-400/30 to-color-500/30'
```

2. **Add icon in `getIconForTag()`:**
```typescript
case 'newtag':
  return <IconComponent size={12} className="text-white" />
```

3. **Add click handler in ActionBar.tsx:**
```typescript
onXMLTagClick={(tag, content) => {
  if (tag === 'newtag') {
    // Handle click action
  }
}}
```

4. **Add detection handler (optional):**
```typescript
onXMLTagDetected={(tag, content) => {
  if (tag === 'newtag') {
    // Handle detection action
  }
}}
```

## Badge System

The Settings icon badge updates automatically on:
- Component mount
- Project change
- `<env>` tag detection in messages
- Settings modal close

Badge calculation counts empty environment variables across all `.env` files in the project.

## Technical Implementation

### XML Detection
```typescript
useEffect(() => {
  if (!onXMLDetected) return
  const xmlPattern = /<(\w+)>(.*?)<\/\1>/g
  let match: RegExpExecArray | null
  while ((match = xmlPattern.exec(text)) !== null) {
    const tag = match[1]
    const content = match[2]
    onXMLDetected(tag, content)
  }
}, [text, onXMLDetected])
```

### Segment Parsing
- Splits text into segments (XML vs regular text)
- Preserves original text flow
- Supports multiple tags in single message

## Future Extensibility

The system is designed to easily support additional tag types:
- `<docs>` - Open documentation
- `<file>` - Navigate to specific file
- `<command>` - Execute commands
- Custom actions based on tag content
