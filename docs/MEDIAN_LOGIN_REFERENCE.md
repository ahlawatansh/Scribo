# Median APK Google Login Setup

The web app already uses Firebase Google login. The Median APK must use Median's native Social Login plugin because Google blocks normal browser Google sign-in inside Android WebViews.

If the APK shows `No credentials available` or `No credential found`, Firebase is usually not the failing part. Median/Android could not get a Google ID token, so the app has no token to pass to Firebase.

## Required setup

1. In Firebase Console -> Authentication -> Sign-in method, enable Google.
2. In Firebase Console -> Project settings -> General, set a support email.
3. In Google Cloud Console -> APIs & Services -> OAuth consent screen, make sure the consent screen is configured for the same Firebase/Google project.
4. In Google Cloud Console -> APIs & Services -> Credentials, create an Android OAuth client.
5. Use the exact Android package name from Median App Studio -> App Identifiers.
6. Use the exact SHA-1 certificate fingerprint for the APK signing key:
   - If Median signs the APK, use the SHA-1 shown/provided by Median.
   - If you self-sign or upload to Google Play, use that signing certificate SHA-1.
   - For a local debug APK, create a second Android OAuth client with the debug SHA-1.
7. In Median App Studio -> Native Plugins -> Social Login -> Settings, add:
   - Android Client ID from the Android OAuth client.
   - Web Client ID from the Firebase/Google web OAuth client.
8. Save, rebuild the APK, then install the new APK.

## Device checks

- The Android device must have a Google account added under system settings.
- Google Play services should be updated.
- Test on a real device, or on an Android 15/API 35+ emulator with Google Play.

## How this app uses the token

`src/firebase/auth.js` calls Median's native Google login. When Median returns an `idToken`, the app exchanges it with Firebase using:

```js
GoogleAuthProvider.credential(idToken)
signInWithCredential(auth, credential)
```

So once Median returns the ID token, the APK logs into the same Firebase users as the web app.
