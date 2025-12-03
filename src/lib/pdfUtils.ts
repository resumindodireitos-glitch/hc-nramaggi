/**
 * Opens HTML content in a new window with print dialog for PDF export
 * Users can use "Save as PDF" in the print dialog
 */
export function printHtmlAsPdf(htmlContent: string, title: string = "Documento") {
  const printWindow = window.open("", "_blank");
  
  if (!printWindow) {
    throw new Error("Popup blocked. Please allow popups for this site.");
  }

  // Write content to new window
  printWindow.document.write(htmlContent);
  printWindow.document.title = title;
  printWindow.document.close();

  // Wait for content to load then trigger print
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  // Fallback if onload doesn't fire
  setTimeout(() => {
    printWindow.print();
  }, 1000);
}

/**
 * Downloads HTML content as a file (fallback option)
 */
export function downloadHtmlFile(htmlContent: string, filename: string) {
  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Decodes base64 HTML content and opens print dialog
 */
export function printBase64Html(base64Content: string, title: string = "Documento") {
  try {
    const decodedHtml = decodeURIComponent(escape(atob(base64Content)));
    printHtmlAsPdf(decodedHtml, title);
  } catch (error) {
    console.error("Error decoding HTML:", error);
    throw new Error("Failed to decode PDF content");
  }
}
