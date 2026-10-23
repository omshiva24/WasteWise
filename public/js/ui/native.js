// Bridge to native features when running inside the Capacitor Android / iOS app.
// The Capacitor native bridge injects window.Capacitor; plugins are called through it,
// so the web build needs no bundler. In a normal browser every call falls back gracefully.

const cap = () => globalThis.Capacitor;

export function isNative() {
  const c = cap();
  if (!c) return false;
  if (typeof c.isNativePlatform === 'function') return c.isNativePlatform();
  return typeof c.getPlatform === 'function' && c.getPlatform() !== 'web';
}

export function platform() {
  const c = cap();
  return c && typeof c.getPlatform === 'function' ? c.getPlatform() : 'web';
}

export async function nativeCall(plugin, method, options = {}) {
  const c = cap();
  if (!c || !isNative()) throw new Error('not-native');
  const p = c.Plugins?.[plugin];
  if (p && typeof p[method] === 'function') return p[method](options);
  if (typeof c.nativePromise === 'function') return c.nativePromise(plugin, method, options);
  throw new Error(`Plugin ${plugin} is not available`);
}

export function nativeListen(plugin, event, cb) {
  const c = cap();
  if (!c || !isNative()) return () => {};
  try {
    const p = c.Plugins?.[plugin];
    const handle = p?.addListener ? p.addListener(event, cb) : c.addListener?.(plugin, event, cb);
    return () => Promise.resolve(handle).then((hd) => hd?.remove?.());
  } catch {
    return () => {};
  }
}

export async function initNative({ onBack, theme = 'light' } = {}) {
  if (!isNative()) return;
  document.documentElement.classList.add('native', `native-${platform()}`);
  nativeCall('SplashScreen', 'hide', { fadeOutDuration: 300 }).catch(() => {});
  setStatusBar(theme);
  if (onBack) nativeListen('App', 'backButton', onBack);
}

export function setStatusBar(theme) {
  if (!isNative()) return;
  nativeCall('StatusBar', 'setStyle', { style: theme === 'dark' ? 'DARK' : 'LIGHT' }).catch(() => {});
  if (platform() === 'android') nativeCall('StatusBar', 'setBackgroundColor', { color: theme === 'dark' ? '#06110c' : '#eef4f0' }).catch(() => {});
}

export async function exitApp() {
  return nativeCall('App', 'exitApp').catch(() => {});
}

/** Register for push notifications (needs Firebase + google-services.json / APNs set up). */
export async function registerPush(onToken) {
  if (!isNative()) return false;
  try {
    let perm = await nativeCall('PushNotifications', 'checkPermissions');
    if (perm.receive === 'prompt') perm = await nativeCall('PushNotifications', 'requestPermissions');
    if (perm.receive !== 'granted') return false;
    nativeListen('PushNotifications', 'registration', (t) => onToken?.(t.value));
    await nativeCall('PushNotifications', 'register');
    return true;
  } catch (e) {
    console.warn('[WasteWise] push registration skipped', e);
    return false;
  }
}

/** Save a file: native share sheet on phones, a download in browsers. */
export async function saveFile(name, mime, bytesOrText) {
  const blob = bytesOrText instanceof Blob ? bytesOrText : new Blob([bytesOrText], { type: mime });
  const file = typeof File !== 'undefined' ? new File([blob], name, { type: mime }) : null;
  if (isNative() && file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    } catch {
      /* fall through to download */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}
