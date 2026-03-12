// afterSign hook for electron-builder: notarize the macOS app bundle.
// Uses the "Plasma" keychain profile stored via:
//   xcrun notarytool store-credentials "Plasma"
const { execSync } = require("child_process");
const path = require("path");

exports.default = async function notarize(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`
  );

  console.log(`\n📤 Notarizing ${appPath} ...\n`);

  // Create a temporary zip for notarization submission
  const tmpZip = path.join(context.outDir, ".notarize-tmp.zip");
  execSync(`ditto -c -k --keepParent "${appPath}" "${tmpZip}"`);

  try {
    execSync(
      `xcrun notarytool submit "${tmpZip}" --keychain-profile "Plasma" --wait`,
      { stdio: "inherit" }
    );

    console.log("\n📎 Stapling notarization ticket...\n");
    execSync(`xcrun stapler staple "${appPath}"`, { stdio: "inherit" });
    execSync(`xcrun stapler validate "${appPath}"`, { stdio: "inherit" });
  } finally {
    execSync(`rm -f "${tmpZip}"`);
  }

  console.log("\n✅ Notarization complete.\n");
};
