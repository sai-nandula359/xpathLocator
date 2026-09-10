// Responsive device emulation — lets a capture session render (and be Ctrl+Clicked) at a real
// device's viewport instead of only the app window's own size, the same way Chrome DevTools'
// device toolbar works. Mirrors DevTools' own well-known preset list so testers already familiar
// with it recognize these immediately, rather than inventing a new naming scheme.
//
// Applying a preset is a two-part operation (see BrowserWorkspace.tsx): `deviceScaleFactor` +
// `mobile` + the CSS width/height go through Electron's webContents.enableDeviceEmulation() (only
// reachable from the main process — see electron/main.cjs's "device:*" IPC handlers), while
// `userAgent` is set directly via the <webview> tag's own setUserAgent(), since that one method
// (unlike device emulation) is exposed on the tag itself.

export interface DevicePreset {
  id: string;
  label: string;
  category: "Phones" | "Tablets" | "Laptops" | "Desktops";
  width: number;
  height: number;
  deviceScaleFactor: number;
  /** Whether the site should see this as a touch/mobile device — affects hover-vs-touch CSS,
   * `ontouchstart` feature detection, and is what flips Chromium's own "mobile" UI affordances
   * (like showing a mobile viewport meta tag's effects) on. */
  mobile: boolean;
  userAgent: string;
}

const IOS_SAFARI_UA = (ios: string, safari: string) =>
  `Mozilla/5.0 (iPhone; CPU iPhone OS ${ios} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${safari} Mobile/15E148 Safari/604.1`;
const IPAD_SAFARI_UA = (ios: string, safari: string) =>
  `Mozilla/5.0 (iPad; CPU OS ${ios} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${safari} Mobile/15E148 Safari/604.1`;
const ANDROID_CHROME_UA = (android: string, model: string, chrome: string) =>
  `Mozilla/5.0 (Linux; Android ${android}; ${model}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chrome} Mobile Safari/537.36`;

export const DEVICE_PRESETS: DevicePreset[] = [
  // Phones
  { id: "iphone-se", label: "iPhone SE", category: "Phones", width: 375, height: 667, deviceScaleFactor: 2, mobile: true, userAgent: IOS_SAFARI_UA("15_0", "15.0") },
  { id: "iphone-12-pro", label: "iPhone 12 Pro", category: "Phones", width: 390, height: 844, deviceScaleFactor: 3, mobile: true, userAgent: IOS_SAFARI_UA("16_0", "16.0") },
  { id: "iphone-14-pro-max", label: "iPhone 14 Pro Max", category: "Phones", width: 430, height: 932, deviceScaleFactor: 3, mobile: true, userAgent: IOS_SAFARI_UA("17_0", "17.0") },
  { id: "pixel-7", label: "Pixel 7", category: "Phones", width: 412, height: 915, deviceScaleFactor: 2.625, mobile: true, userAgent: ANDROID_CHROME_UA("13", "Pixel 7", "115.0.0.0") },
  { id: "galaxy-s20-ultra", label: "Galaxy S20 Ultra", category: "Phones", width: 412, height: 915, deviceScaleFactor: 3.5, mobile: true, userAgent: ANDROID_CHROME_UA("11", "SM-G981B", "115.0.0.0") },
  { id: "galaxy-s8", label: "Galaxy S8+", category: "Phones", width: 360, height: 740, deviceScaleFactor: 4, mobile: true, userAgent: ANDROID_CHROME_UA("9", "SM-G955U", "115.0.0.0") },

  // Tablets
  { id: "ipad-mini", label: "iPad Mini", category: "Tablets", width: 768, height: 1024, deviceScaleFactor: 2, mobile: true, userAgent: IPAD_SAFARI_UA("16_0", "16.0") },
  { id: "ipad-air", label: "iPad Air", category: "Tablets", width: 820, height: 1180, deviceScaleFactor: 2, mobile: true, userAgent: IPAD_SAFARI_UA("16_0", "16.0") },
  { id: "ipad-pro-11", label: 'iPad Pro 11"', category: "Tablets", width: 834, height: 1194, deviceScaleFactor: 2, mobile: true, userAgent: IPAD_SAFARI_UA("16_0", "16.0") },
  { id: "surface-pro-7", label: "Surface Pro 7", category: "Tablets", width: 912, height: 1368, deviceScaleFactor: 2, mobile: true, userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36 Edg/115.0.0.0" },

  // Laptops
  { id: "laptop", label: "Laptop", category: "Laptops", width: 1366, height: 768, deviceScaleFactor: 1, mobile: false, userAgent: "" },
  { id: "laptop-l", label: "Laptop L", category: "Laptops", width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false, userAgent: "" },

  // Desktops
  { id: "desktop-1440", label: "Desktop 1440×900", category: "Desktops", width: 1440, height: 900, deviceScaleFactor: 1, mobile: false, userAgent: "" },
  { id: "desktop-1536", label: "Desktop 1536×864", category: "Desktops", width: 1536, height: 864, deviceScaleFactor: 1, mobile: false, userAgent: "" },
];

export function findDevicePreset(id: string): DevicePreset | null {
  return DEVICE_PRESETS.find((d) => d.id === id) ?? null;
}

export const DEVICE_CATEGORIES: DevicePreset["category"][] = ["Phones", "Tablets", "Laptops", "Desktops"];
