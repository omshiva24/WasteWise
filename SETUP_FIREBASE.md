# Going live with Firebase (shared data across phones)

Out of the box WasteWise runs in **demo mode**: realistic sample data stored on the device, so anyone can try every role instantly. To let real supervisors, vendors and admins work together on different phones, connect a free Firebase project. It takes about 10 minutes.

## 1. Create the project

1. Go to <https://console.firebase.google.com> → **Add project** → name it `wastewise` (Google Analytics is optional).
2. **Build → Authentication → Get started → Email/Password → Enable**.
3. **Build → Firestore Database → Create database** → choose a location (e.g. `asia-south1` Mumbai) → start in **production mode**.
4. **Project settings (gear) → Your apps → Web (`</>`)** → register an app called `WasteWise web`. Copy the `firebaseConfig` object.

## 2. Paste the config

Open `public/js/config.js` and replace `null` with your config:

```js
export const FIREBASE_CONFIG = {
  apiKey: 'AIza…',
  authDomain: 'wastewise-xxxx.firebaseapp.com',
  projectId: 'wastewise-xxxx',
  storageBucket: 'wastewise-xxxx.appspot.com',
  messagingSenderId: '…',
  appId: '…',
};
```

The web config is **not a secret** (it ships inside every Firebase web app). Your data is protected by `firestore.rules`.

## 3. Deploy the security rules, indexes and Cloud Functions

```bash
npm install -g firebase-tools
firebase login
firebase use --add            # pick your project
firebase deploy --only firestore:rules,firestore:indexes
cd functions && npm install && cd ..
firebase deploy --only functions   # needs the Blaze (pay-as-you-go) plan; the free monthly quota easily covers a campus
```

The functions send a notification on every status change and run the **7-day overdue check** every 6 hours. Without them the app still works; you just won't get server-side alerts or push notifications.

## 4. Make yourself admin

1. Open the app and **Create an account**.
2. In the Firebase console → **Firestore → users → your document**, change `role` from `member` to `admin`.
3. Sign out and back in. You can now approve supervisors and vendors from **Users**, and add bins from **Bins**.

## 5. Push notifications on phones (optional)

- **Android:** Project settings → Your apps → **Add app → Android**, package name `com.omshiva.wastewise`. Download `google-services.json` into `android/app/` after running `npx cap add android`.
- **iOS:** add an iOS app with bundle ID `com.omshiva.wastewise`, upload your APNs key (Project settings → Cloud Messaging) and put `GoogleService-Info.plist` into `ios/App/App/`.

Then rebuild the app (`npx cap sync`). The app saves each phone's push token to the user's profile, and the Cloud Functions send to it.

## 6. Redeploy the web app

Commit the updated `public/js/config.js` and push - Vercel redeploys automatically. Or host on Firebase instead: `firebase deploy --only hosting`.
