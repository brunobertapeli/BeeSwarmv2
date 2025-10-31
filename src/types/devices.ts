export type DeviceType = 'mobile' | 'desktop'
export type Orientation = 'portrait' | 'landscape'

export interface Device {
  id: string
  name: string
  type: DeviceType
  width: number
  height: number
  icon?: string
}

// Mobile devices
export const MOBILE_DEVICES: Device[] = [
  {
    id: 'iphone-16-pro',
    name: 'iPhone 16 Pro',
    type: 'mobile',
    width: 393,
    height: 852,
  },
  {
    id: 'iphone-16',
    name: 'iPhone 16',
    type: 'mobile',
    width: 390,
    height: 844,
  },
  {
    id: 'iphone-se',
    name: 'iPhone SE',
    type: 'mobile',
    width: 375,
    height: 667,
  },
  {
    id: 'samsung-s24-ultra',
    name: 'Samsung S24 Ultra',
    type: 'mobile',
    width: 384,
    height: 824,
  },
  {
    id: 'samsung-s22',
    name: 'Samsung Galaxy S22',
    type: 'mobile',
    width: 360,
    height: 800,
  },
  {
    id: 'pixel-8-pro',
    name: 'Google Pixel 8 Pro',
    type: 'mobile',
    width: 412,
    height: 915,
  },
  {
    id: 'ipad-air',
    name: 'iPad Air',
    type: 'mobile',
    width: 820,
    height: 1180,
  },
]

// Desktop resolutions
export const DESKTOP_DEVICES: Device[] = [
  {
    id: 'desktop-1920',
    name: '1920×1080 (Full HD)',
    type: 'desktop',
    width: 1920,
    height: 1080,
  },
  {
    id: 'desktop-1440',
    name: '2560×1440 (QHD)',
    type: 'desktop',
    width: 2560,
    height: 1440,
  },
  {
    id: 'desktop-1366',
    name: '1366×768 (Laptop)',
    type: 'desktop',
    width: 1366,
    height: 768,
  },
  {
    id: 'desktop-1536',
    name: '1536×864 (Laptop)',
    type: 'desktop',
    width: 1536,
    height: 864,
  },
  {
    id: 'desktop-1280',
    name: '1280×720 (HD)',
    type: 'desktop',
    width: 1280,
    height: 720,
  },
  {
    id: 'desktop-3840',
    name: '3840×2160 (4K)',
    type: 'desktop',
    width: 3840,
    height: 2160,
  },
]

// Helper to get device by ID
export const getDeviceById = (id: string): Device | undefined => {
  return [...MOBILE_DEVICES, ...DESKTOP_DEVICES].find((d) => d.id === id)
}

// Get default device for each type
export const getDefaultDevice = (type: DeviceType): Device => {
  if (type === 'mobile') {
    return MOBILE_DEVICES[0] // iPhone 16 Pro
  }
  return DESKTOP_DEVICES[0] // 1920×1080
}
