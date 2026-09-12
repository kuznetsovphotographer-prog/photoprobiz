export const DEVICE_TYPES = ['computer', 'phone', 'tablet', 'unknown'] as const;
export const OS_FAMILIES = [
  'windows',
  'macos',
  'android',
  'ios',
  'ipados',
  'harmonyos',
  'linux',
  'chromeos',
  'unknown',
] as const;

export type DeviceType = (typeof DEVICE_TYPES)[number];
export type OsFamily = (typeof OS_FAMILIES)[number];

export type DeviceProfile = {
  deviceType: DeviceType;
  osFamily: OsFamily;
};

export type NavigatorSnapshot = {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  userAgentData?: {
    mobile?: boolean;
    platform?: string;
  };
};

const UNKNOWN_PROFILE: DeviceProfile = {
  deviceType: 'unknown',
  osFamily: 'unknown',
};

/**
 * Converts browser hints to deliberately coarse values. The raw user-agent,
 * browser version, device model and hardware identifiers never leave the page.
 */
export function classifyDevice(snapshot: NavigatorSnapshot | null | undefined): DeviceProfile {
  if (!snapshot) return UNKNOWN_PROFILE;

  const userAgent = String(snapshot.userAgent || '').toLowerCase();
  const platform = String(snapshot.userAgentData?.platform || snapshot.platform || '').toLowerCase();
  const touchPoints = Number.isFinite(snapshot.maxTouchPoints) ? Number(snapshot.maxTouchPoints) : 0;
  const mobile = snapshot.userAgentData?.mobile === true || /\bmobile\b/.test(userAgent);

  if (/openharmony|harmonyos|huawei.*harmony/.test(`${userAgent} ${platform}`)) {
    const tablet = /\b(tablet|pad)\b/.test(userAgent);
    return { deviceType: tablet ? 'tablet' : mobile ? 'phone' : 'unknown', osFamily: 'harmonyos' };
  }

  if (/ipad/.test(userAgent) || (/mac/.test(platform) && touchPoints > 1)) {
    return { deviceType: 'tablet', osFamily: 'ipados' };
  }

  if (/iphone|ipod/.test(userAgent)) return { deviceType: 'phone', osFamily: 'ios' };

  if (/android/.test(userAgent) || /android/.test(platform)) {
    return { deviceType: mobile ? 'phone' : 'tablet', osFamily: 'android' };
  }

  if (/cros/.test(userAgent) || /chrome\s?os/.test(platform)) {
    return { deviceType: 'computer', osFamily: 'chromeos' };
  }

  if (/windows|win32|win64/.test(`${userAgent} ${platform}`)) {
    return { deviceType: 'computer', osFamily: 'windows' };
  }

  if (/macintosh|macintel|macos|mac os x/.test(`${userAgent} ${platform}`)) {
    return { deviceType: 'computer', osFamily: 'macos' };
  }

  if (/linux|x11/.test(`${userAgent} ${platform}`)) {
    return { deviceType: 'computer', osFamily: 'linux' };
  }

  return mobile ? { deviceType: 'phone', osFamily: 'unknown' } : UNKNOWN_PROFILE;
}

export function detectDeviceProfile(): DeviceProfile {
  try {
    if (typeof navigator === 'undefined') return UNKNOWN_PROFILE;
    return classifyDevice(navigator as NavigatorSnapshot);
  } catch {
    return UNKNOWN_PROFILE;
  }
}
