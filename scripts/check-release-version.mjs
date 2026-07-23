import { readFileSync } from "node:fs";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const manifest = readJson("manifest.json");
const packageJson = readJson("package.json");
const versions = readJson("versions.json");
const releaseTag = process.env.RELEASE_TAG || manifest.version;
const ysVersionPattern = /^\d+\.\d+\.\d+\+ys\.[1-9]\d*$/;

const errors = [];

if (!ysVersionPattern.test(releaseTag)) {
  errors.push(
    `Release tag must match X.Y.Z+ys.N with N >= 1; received ${releaseTag}`,
  );
}

if (manifest.version !== releaseTag) {
  errors.push(
    `manifest.json version ${manifest.version} does not match release tag ${releaseTag}`,
  );
}

if (packageJson.version !== releaseTag) {
  errors.push(
    `package.json version ${packageJson.version} does not match release tag ${releaseTag}`,
  );
}

if (!Object.prototype.hasOwnProperty.call(versions, releaseTag)) {
  errors.push(`versions.json does not contain ${releaseTag}`);
} else if (versions[releaseTag] !== manifest.minAppVersion) {
  errors.push(
    `versions.json maps ${releaseTag} to ${versions[releaseTag]}, expected ${manifest.minAppVersion}`,
  );
}

const upstreamBase = releaseTag.split("+", 1)[0];
if (!Object.prototype.hasOwnProperty.call(versions, upstreamBase)) {
  errors.push(`versions.json does not contain upstream base ${upstreamBase}`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`ERROR: ${error}`);
  }
  process.exit(1);
}

console.log(`Verified Young Security release ${releaseTag}`);
