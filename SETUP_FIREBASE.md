# Connecting WasteWise to Firebase

WasteWise stores real accounts and live data in **Firebase** (Google). One Firebase project serves the website, the Android app and the iPhone web app. Setup takes about 10 minutes and works from a phone browser.

## 1. Create the project

1. Open <https://console.firebase.google.com> and sign in with your Google account.
2. **Create a project** → name it `WasteWise` → you can turn Google Analytics off → **Create**.

## 2. Turn on sign-in methods

**Build → Authentication → Get started → Sign-in method**, then enable:

| Method | Notes |
|---|---|
| **Phone** | OTP by SMS. Google only sends real SMS on the pay-as-you-go **Blaze** plan (small charge per SMS). On the free plan you can still add *test numbers* under **Phone numbers for testing** (e.g. `+91 9999900001` with code `123456`). |
| **Email/Password** | Free. Includes "Forgot password" emails. |
| **Google** | Free. Pick your email as the support email. Works on the website (not inside the Android app). |

Then **Authentication → Settings → Authorized domains → Add domain** → `wastewise-six-indol.vercel.app` (and any custom domain you add later).

## 3. Create the database

**Build → Firestore Database → Create database** → Standard edition → location **asia-south1 (Mumbai)** → **Start in production mode**.

## 4. Publish the security rules

**Firestore Database → Rules** → delete everything in the editor → paste the whole of [`firestore.rules`](firestore.rules) → **Publish**.

These rules are what keep the data safe: they enforce roles, the pickup lifecycle and who can read what. Without them the app shows "Can't reach the WasteWise database".

## 5. Connect the app

**Project settings (gear) → General → Your apps → Web (`</>`)** → nickname `WasteWise` → **Register app**. Copy the `firebaseConfig` values into `public/js/config.js`:

```js
export const FIREBASE_CONFIG = {
  apiKey: 'AIza…',
  authDomain: 'wastewise-xxxx.firebaseapp.com',
  projectId: 'wastewise-xxxx',
  storageBucket: 'wastewise-xxxx.firebasestorage.app',
  messagingSenderId: '1234567890',
  appId: '1:1234567890:web:abc123',
};
```

This config is **not a secret** - it only identifies the project; security comes from the rules in step 4. Push the change and Vercel redeploys the website; GitHub Actions rebuilds the Android APK.

## 6. Become the admin

Open the app and sign in **first**, before sharing the link. **The very first account becomes the Admin.** Everyone after that joins as a member and can ask for *Supervisor* or *Vendor* access, which the admin approves in **Users**.

Then, as admin:

1. **Bins** → add your bins, pin each one on the map (or stand next to it and tap **Use my location**) and print the QR stickers.
2. **Dashboard → Share** the invite link with your supervisors and vendors.
3. **Users** → approve them as they sign up.

## Optional extras (Blaze plan)

- **Real SMS for phone OTP** - upgrade to Blaze (set a budget alert, e.g. ₹200).
- **Push notifications to phones** and the automatic **7-day overdue check** - deploy the Cloud Functions in `functions/`:
  `npm install -g firebase-tools && firebase login && firebase use <project-id> && (cd functions && npm install) && firebase deploy --only functions`,
  then add `google-services.json` to the Android build and set `PUSH_ENABLED = true` in `public/js/config.js`.
  Without them, everything still works: notifications appear in the app's bell, and overdue pickups are highlighted in red.

## Free plan limits (Spark)

50,000 document reads and 20,000 writes per day and 1 GiB of storage - plenty for a campus or a city ward.
