// WasteWise (c) 2026 P Om Shiva - M.Tech CSE, Pondicherry University. All rights reserved. Do not copy without written permission.
// Adds camera, photo, location and notification permissions to the generated native projects.
// Run after `npx cap add android` / `npx cap add ios`:  node scripts/native-setup.mjs [android|ios|all]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const target = process.argv[2] || 'all';

function patchAndroid() {
  const f = 'android/app/src/main/AndroidManifest.xml';
  if (!existsSync(f)) return console.log('android: project not found, skipped');
  let xml = readFileSync(f, 'utf8');
  const perms = [
    '<uses-permission android:name="android.permission.CAMERA" />',
    '<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />',
    '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />',
    '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
    '<uses-permission android:name="android.permission.VIBRATE" />',
    '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
    '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
    '<uses-feature android:name="android.hardware.camera" android:required="false" />',
    '<uses-feature android:name="android.hardware.location.gps" android:required="false" />',
  ].filter((p) => !xml.includes(p.split('"')[1]));
  if (perms.length) xml = xml.replace('</manifest>', `    ${perms.join('\n    ')}\n</manifest>`);
  writeFileSync(f, xml);
  console.log(`android: added ${perms.length} permission(s)`);
}

function patchIos() {
  const f = 'ios/App/App/Info.plist';
  if (!existsSync(f)) return console.log('ios: project not found, skipped');
  let plist = readFileSync(f, 'utf8');
  const keys = {
    NSCameraUsageDescription: 'WasteWise uses the camera to scan bin QR codes and photograph bins for pickup requests.',
    NSPhotoLibraryUsageDescription: 'WasteWise lets you attach a photo of the bin from your library.',
    NSPhotoLibraryAddUsageDescription: 'WasteWise can save photos you take of bins.',
    NSLocationWhenInUseUsageDescription: 'WasteWise uses your location to pin pickups on the map and show vendors the nearest pickups.',
  };
  let added = 0;
  for (const [k, v] of Object.entries(keys)) {
    if (plist.includes(`<key>${k}</key>`)) continue;
    plist = plist.replace(/<dict>/, `<dict>\n\t<key>${k}</key>\n\t<string>${v}</string>`);
    added += 1;
  }
  writeFileSync(f, plist);
  console.log(`ios: added ${added} usage description(s)`);
}

if (target === 'android' || target === 'all') patchAndroid();
if (target === 'ios' || target === 'all') patchIos();
