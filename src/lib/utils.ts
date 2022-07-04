export function downloadBlob(
  data: Uint8Array | Uint8ClampedArray,
  fileName: string,
  mimeType: string = "application/octet-stream"
) {
  const blob = new Blob([data], {
    type: mimeType,
  });
  const url = window.URL.createObjectURL(blob);
  downloadURL(url, fileName);
  setTimeout(function () {
    return window.URL.revokeObjectURL(url);
  }, 1000);
}

export function downloadURL(url: string, fileName: string) {
  var a;
  a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.style.display = "none";
  a.click();
  a.remove();
}
