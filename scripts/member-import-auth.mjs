export function gcloudExecutable(platform = process.platform) {
  return platform === "win32" ? "gcloud.cmd" : "gcloud";
}
