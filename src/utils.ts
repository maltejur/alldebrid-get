const mags = " KMGTPEZY";

export function humanSize(bytes: number, digits = 1) {
  var magnitude = Math.min(
    (Math.log(bytes) / Math.log(1024)) | 0,
    mags.length - 1
  );
  var result = bytes / Math.pow(1024, magnitude);
  var suffix = mags[magnitude].trim() + "B";
  return result.toFixed(magnitude > 0 ? digits : 0) + suffix;
}
