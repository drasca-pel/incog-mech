// Handing a project to the person as a file, and reading a file they pick.

// Share (phones) or download (computers) a piece of text as a file
export async function shareOrDownload(filename, text, mime = "application/json") {
  const file = typeof File !== "undefined" ? new File([text], filename, { type: mime }) : null;
  if (file && typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return "shared";
    } catch (err) {
      if (err && err.name === "AbortError") return "cancelled";
      // fall through to a normal download
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "downloaded";
}

export const safeFileName = (name) => String(name || "project").replace(/[\\/:*?"<>|]+/g, "_").trim() || "project";

// Open the file picker and give back the text of the chosen file (or null)
export function pickTextFile(accept = ".incog,.json,application/json") {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => {
      const f = input.files && input.files[0];
      if (!f) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve({ name: f.name, text: String(reader.result) });
      reader.onerror = () => resolve(null);
      reader.readAsText(f);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
