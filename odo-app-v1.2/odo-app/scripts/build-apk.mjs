// One command to turn the code into an installable APK: `npm run apk`
// Works on macOS, Linux and Windows. Requires the Android SDK (install
// Android Studio once) and a JDK. First run downloads Gradle + build tools,
// so it can take a few minutes; later runs are fast.

import { execSync } from "node:child_process";
import { existsSync, copyFileSync } from "node:fs";
import { platform } from "node:os";
import { join } from "node:path";

const run = (cmd, opts = {}) => execSync(cmd, { stdio: "inherit", ...opts });

try {
  console.log("→ Building the web bundle…");
  run("npm run build");

  if (!existsSync("android")) {
    console.log("→ First run: creating the Android project…");
    run("npx cap add android");
  } else {
    console.log("→ Syncing the latest build into Android…");
    run("npx cap sync android");
  }

  console.log("→ Compiling the APK with Gradle (first run is slow — hang tight)…");
  const gradlew = platform() === "win32" ? "gradlew.bat" : "./gradlew";
  run(`${gradlew} assembleDebug`, { cwd: "android" });

  const built = join("android", "app", "build", "outputs", "apk", "debug", "app-debug.apk");
  if (existsSync(built)) {
    copyFileSync(built, "odo-debug.apk");
    console.log("\n✅ Done. Your app is:  odo-debug.apk  (in this folder)");
    console.log("   Send it to your Android phone (USB / Drive / email) and tap to install.");
    console.log("   You'll be asked to allow installing from unknown sources — say yes.\n");
  } else {
    console.log("\n⚠️  Build ran but the APK wasn't at the expected path:\n   " + built);
  }
} catch (err) {
  console.error("\n❌ Build failed.");
  console.error("   Most common cause: the Android SDK isn't set up yet.");
  console.error("   Install Android Studio once, open it so it downloads the SDK, then retry `npm run apk`.");
  process.exit(1);
}
