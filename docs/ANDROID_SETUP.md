# Free Capacitor Android APK Guide

This replaces the Median APK path. It keeps the same React/Vite/Firebase web app, but builds a real Android app locally with Capacitor.

## What is free

- Capacitor Android project: free/open source
- Android Studio: free
- Firebase Authentication Google sign-in: free on Spark for normal use
- Firestore: free within Spark limits
- `@capacitor-firebase/authentication`: free npm package

## What was added to this project

- `capacitor.config.json`
- `android/`
- Native Google sign-in bridge in `src/firebase/auth.js`
- npm scripts:
  - `npm run cap:sync`
  - `npm run cap:open`

The Android app package name is:

```text
com.shyam.agriculturalstore
```

## Step 1: Install Android Studio

1. Download Android Studio from Google.
2. Install it normally.
3. Open Android Studio once and let it install:
   - Android SDK
   - Android SDK Platform
   - Android SDK Build-Tools
   - Android Emulator if you want to test on emulator

## Step 2: Add Android app in Firebase

1. Open Firebase Console.
2. Open project `shyam-agricultural-store`.
3. Go to Project settings -> General.
4. Under "Your apps", click the Android icon.
5. Android package name:

```text
com.shyam.agriculturalstore
```

6. App nickname:

```text
Shyam Agricultural Store Capacitor
```

7. Do not worry about SHA-1 yet if Firebase lets you continue.
8. Download `google-services.json`.
9. Put it here:

```text
android/app/google-services.json
```

## Step 3: Create debug APK once

Run:

```bash
npm run cap:sync
cd android
./gradlew assembleDebug
```

The debug APK will be here:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Install it on your Android phone for testing.

## Step 4: Get debug SHA-1

Run this on Mac:

```bash
keytool -list -v -alias androiddebugkey -keystore ~/.android/debug.keystore -storepass android -keypass android
```

Copy the `SHA1` value.

## Step 5: Add SHA-1 in Firebase

1. Firebase Console -> Project settings -> General.
2. Open the Android app `com.shyam.agriculturalstore`.
3. Add the debug SHA-1.
4. Download `google-services.json` again.
5. Replace:

```text
android/app/google-services.json
```

6. Run:

```bash
npm run cap:sync
```

## Step 6: Test Google login

Run the app on a real Android phone:

```bash
npm run cap:open
```

In Android Studio:

1. Wait for Gradle sync.
2. Select your phone.
3. Click Run.
4. Tap "Continue with Google".

If it works, Firebase will sign in or create the user automatically, the same as web.

## Step 7: Create release APK

In Android Studio:

1. Open the project with:

```bash
npm run cap:open
```

2. Go to Build -> Generate Signed Bundle / APK.
3. Choose APK.
4. Create a new keystore if you do not have one.
5. Save the keystore somewhere private, not in this repo.
6. Build the release APK.

The release APK will be under:

```text
android/app/release/
```

## Step 8: Add release SHA-1

The release APK uses your release keystore, not the debug keystore. Google login will fail in the release APK until Firebase has the release SHA-1.

In Android Studio, after creating the keystore, get its SHA-1:

```bash
keytool -list -v -keystore /path/to/your-release-key.jks -alias your_key_alias
```

Then:

1. Firebase Console -> Project settings -> General.
2. Open Android app `com.shyam.agriculturalstore`.
3. Add release SHA-1.
4. Download `google-services.json` again.
5. Replace `android/app/google-services.json`.
6. Run `npm run cap:sync`.
7. Generate the signed APK again.

## Every time you change web code

Run:

```bash
npm run cap:sync
```

Then rebuild/run from Android Studio.

## Important

Do not use the old Median package name for this app. This Capacitor APK uses:

```text
com.shyam.agriculturalstore
```

So Firebase SHA-1 setup must be done for this exact package.
