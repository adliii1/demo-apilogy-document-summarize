// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

document.addEventListener("DOMContentLoaded", () => {
  // DOM elements
  const uploadZone = document.getElementById("upload-zone");
  const fileUpload = document.getElementById("file-upload");
  const fileNameDisplay = document.getElementById("file-name");
  const summarizeBtn = document.getElementById("summarize-btn");
  const summaryContent = document.getElementById("summary-content");
  const documentTitle = document.getElementById("document-title");
  const pdfContainer = document.getElementById("pdf-container");
  const pdfControls = document.getElementById("pdf-controls");
  const currentPageSpan = document.getElementById("current-page");
  const totalPagesSpan = document.getElementById("total-pages");
  const prevPageBtn = document.getElementById("prev-page");
  const nextPageBtn = document.getElementById("next-page");
  const zoomInBtn = document.getElementById("zoom-in");
  const zoomOutBtn = document.getElementById("zoom-out");

  // State variables
  let isRequesting = false;
  let selectedFile = null;
  let pdfDoc = null;
  let currentPage = 1;
  let totalPages = 0;
  let currentScale = 1.2;

  // Event listeners
  uploadZone.addEventListener("click", () => fileUpload.click());
  fileUpload.addEventListener("change", handleFileSelect);
  summarizeBtn.addEventListener("click", handleSummarize);
  prevPageBtn.addEventListener("click", () => changePage(-1));
  nextPageBtn.addEventListener("click", () => changePage(1));
  zoomInBtn.addEventListener("click", () => changeZoom(0.2));
  zoomOutBtn.addEventListener("click", () => changeZoom(-0.2));

  // Drag and drop functionality
  uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadZone.style.borderColor = "var(--primary-color)";
    uploadZone.style.background = "var(--tertiary-color)";
  });

  uploadZone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    if (!uploadZone.classList.contains("has-file")) {
      uploadZone.style.borderColor = "var(--border-color)";
      uploadZone.style.background = "var(--quaternary-color)";
    }
  });

  uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      fileUpload.files = files;
      handleFileSelect();
    }
  });

  // Handle file selection
  function handleFileSelect() {
    if (fileUpload.files.length > 0) {
      selectedFile = fileUpload.files[0];
      fileNameDisplay.textContent = selectedFile.name;
      uploadZone.classList.add("has-file");
      documentTitle.textContent = selectedFile.name;

      // Load preview based on file type
      if (selectedFile.type === "application/pdf") {
        loadPDFPreview(selectedFile);
      } else if (
        selectedFile.type === "text/plain" ||
        selectedFile.name.toLowerCase().endsWith(".txt")
      ) {
        loadTextFilePreview(selectedFile);
      } else {
        showUnsupportedFilePreview();
      }
    }
  }

  // Load PDF preview
  async function loadPDFPreview(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      totalPages = pdfDoc.numPages;
      currentPage = 1;

      totalPagesSpan.textContent = totalPages;
      pdfControls.style.display = "flex";

      await renderPage(currentPage);
      updatePageControls();
    } catch (error) {
      console.error("Error loading PDF:", error);
      showError("Gagal memuat preview PDF");
    }
  }

  // Render PDF page
  async function renderPage(pageNum) {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: currentScale });

      // Clear previous content
      pdfContainer.innerHTML = "";

      // Create canvas
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      canvas.className = "pdf-canvas";

      const pageDiv = document.createElement("div");
      pageDiv.className = "pdf-page";
      pageDiv.appendChild(canvas);
      pdfContainer.appendChild(pageDiv);

      // Render PDF page into canvas context
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
      currentPageSpan.textContent = pageNum;
    } catch (error) {
      console.error("Error rendering page:", error);
    }
  }

  // Change page
  function changePage(delta) {
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
      currentPage = newPage;
      renderPage(currentPage);
      updatePageControls();
    }
  }

  // Change zoom
  function changeZoom(delta) {
    const newScale = currentScale + delta;
    if (newScale >= 0.5 && newScale <= 3.0) {
      currentScale = newScale;
      if (pdfDoc) {
        renderPage(currentPage);
      }
    }
  }

  // Update page controls
  function updatePageControls() {
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
  }

  // Load and display text file content
  async function loadTextFilePreview(file) {
    try {
      pdfControls.style.display = "none";

      // Show loading state
      pdfContainer.innerHTML = `
        <div class="pdf-placeholder">
          <div class="loading-spinner"></div>
          <h3>Memuat file teks...</h3>
        </div>
      `;

      const text = await readTextFile(file);

      // Display text content with proper formatting
      pdfContainer.innerHTML = `
        <div class="text-file-container">
          <div class="text-file-header">
            <h3>
              <span class="material-symbols-outlined">description</span>
              ${file.name}
            </h3>
            <div class="file-info">
              <span>Ukuran: ${formatFileSize(file.size)}</span>
              <span>•</span>
              <span>Karakter: ${text.length.toLocaleString()}</span>
              <span>•</span>
              <span>Baris: ${text.split("\n").length.toLocaleString()}</span>
            </div>
          </div>
          <div class="text-file-content">
            <pre class="text-content">${escapeHtml(text)}</pre>
          </div>
        </div>
      `;
    } catch (error) {
      console.error("Error loading text file:", error);
      showError("Gagal memuat file teks: " + error.message);
    }
  }

  // Read text file content
  function readTextFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        resolve(e.target.result);
      };

      reader.onerror = (e) => {
        reject(
          new Error(
            "Gagal membaca file: " + e.target.error?.message || "Unknown error"
          )
        );
      };

      // Try to read as UTF-8 first
      reader.readAsText(file, "UTF-8");
    });
  }

  // Format file size for display
  function formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  // Escape HTML characters to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Show text file preview (fallback for when file can't be read)
  function showTextFilePreview() {
    pdfControls.style.display = "none";
    pdfContainer.innerHTML = `
      <div class="pdf-placeholder">
        <span class="material-symbols-outlined placeholder-icon">description</span>
        <h3>File Teks</h3>
        <p>Preview tidak tersedia untuk file ini. Klik "Ringkas Dokumen" untuk melihat ringkasan.</p>
      </div>
    `;
  }

  // Show unsupported file preview
  function showUnsupportedFilePreview() {
    pdfControls.style.display = "none";
    pdfContainer.innerHTML = `
      <div class="pdf-placeholder">
        <span class="material-symbols-outlined placeholder-icon" style="color: #f59e0b;">warning</span>
        <h3>Format File Tidak Didukung</h3>
        <p>File ini mungkin tidak dapat diproses. Hanya file PDF dan TXT yang didukung sepenuhnya.</p>
      </div>
    `;
  }

  // Show error
  function showError(message) {
    pdfContainer.innerHTML = `
            <div class="pdf-placeholder">
              <span class="material-symbols-outlined placeholder-icon" style="color: #ef4444;">error</span>
              <h3>Error</h3>
              <p>${message}</p>
            </div>
          `;
  }

  // Handle summarize button
  function handleSummarize() {
    if (!selectedFile) {
      alert("Silakan pilih file terlebih dahulu.");
      return;
    }
    if (isRequesting) {
      return;
    }
    getRealBotResponse(selectedFile);
  }

  // Set controls disabled state
  function setControlsDisabled(disabled) {
    isRequesting = disabled;
    summarizeBtn.disabled = disabled;
    fileUpload.disabled = disabled;

    if (disabled) {
      summarizeBtn.innerHTML = `
              <div class="loading-spinner"></div>
              Memproses...
            `;
    } else {
      summarizeBtn.innerHTML = `
              <span class="material-symbols-outlined" style="font-size: 16px; margin-right: 4px;">auto_awesome</span>
              Ringkas Dokumen
            `;
    }
  }

  // Display summary status
  function displaySummaryStatus(type, message = "") {
    if (type === "loading") {
      summaryContent.className = "summary-content";
      summaryContent.innerHTML = `
              <div style="text-align: center; padding: 20px;">
                <div class="loading-spinner"></div>
                <p style="margin-top: 12px; color: var(--text-secondary);">Sedang memproses dokumen...</p>
              </div>
            `;
    } else if (type === "error") {
      summaryContent.className = "summary-content";
      summaryContent.innerHTML = `
              <h3 style="color: #ef4444;">Terjadi Kesalahan</h3>
              <p style="color: #ef4444;">${message}</p>
            `;
    } else if (type === "summary") {
      summaryContent.className = "summary-content";
      summaryContent.innerHTML = `
              <div class="summary-header">
                <h3>Ringkasan Dokumen</h3>
                <button class="copy-btn" id="copy-summary-btn">
                  <span class="material-symbols-outlined">content_copy</span>
                  Copy
                </button>
              </div>
              <div id="summary-text" style="line-height: 1.6;">${message.replace(
                /\n/g,
                "<br>"
              )}</div>
            `;

      // Add event listener to copy button
      const copyBtn = document.getElementById("copy-summary-btn");
      if (copyBtn) {
        copyBtn.addEventListener("click", () =>
          copyToClipboard(message, copyBtn)
        );
      }
    }
  }

  // Copy to clipboard function
  function copyToClipboard(text, button) {
    // Clean the text by removing HTML and fixing line breaks
    const cleanText = text
      .replace(/<br\s*\/?>/gi, "\n") // Replace <br> tags with newlines
      .replace(/<[^>]*>/g, "") // Remove all HTML tags
      .replace(/&nbsp;/g, " ") // Replace &nbsp; with space
      .replace(/&amp;/g, "&") // Replace &amp; with &
      .replace(/&lt;/g, "<") // Replace &lt; with <
      .replace(/&gt;/g, ">") // Replace &gt; with >
      .replace(/&quot;/g, '"') // Replace &quot; with "
      .replace(/&#39;/g, "'") // Replace &#39; with '
      .trim(); // Remove leading/trailing whitespace

    // Try modern clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(cleanText)
        .then(() => {
          showCopySuccess(button);
        })
        .catch((err) => {
          console.warn("Clipboard API failed, using fallback:", err);
          fallbackCopyTextToClipboard(cleanText, button);
        });
    } else {
      // Use fallback for older browsers or non-secure contexts
      fallbackCopyTextToClipboard(cleanText, button);
    }
  }

  // Fallback copy function for older browsers
  function fallbackCopyTextToClipboard(text, button) {
    const textArea = document.createElement("textarea");
    textArea.value = text;

    // Make the textarea out of viewport
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand("copy");
      if (successful) {
        showCopySuccess(button);
      } else {
        showCopyError(button);
      }
    } catch (err) {
      console.error("Fallback copy failed:", err);
      showCopyError(button);
    }

    document.body.removeChild(textArea);
  }

  // Show copy success feedback
  function showCopySuccess(button) {
    const originalHTML = button.innerHTML;
    button.classList.add("copied");
    button.innerHTML = `
      <span class="material-symbols-outlined">check</span>
      Tersalin
    `;

    setTimeout(() => {
      button.classList.remove("copied");
      button.innerHTML = originalHTML;
    }, 2000);
  }

  // Show copy error feedback
  function showCopyError(button) {
    const originalHTML = button.innerHTML;
    button.innerHTML = `
      <span class="material-symbols-outlined">error</span>
      Gagal
    `;

    setTimeout(() => {
      button.innerHTML = originalHTML;
    }, 2000);
  }

  // Make copyToClipboard function global (if needed)
  window.copyToClipboard = copyToClipboard;

  // API call function
  async function getRealBotResponse(file) {
    setControlsDisabled(true);
    displaySummaryStatus("loading");

    const formData = new FormData();
    formData.append("file", file);

    const apiKey = "YOUR-API-KEY";
    const baseUrl =
      "https://telkom-ai-dag.api.apilogy.id/LLama3Summarize/0.0.4/telkomllm/summarize_file?summary_detail=0";

    try {
      const response = await fetch(baseUrl, {
        method: "POST",
        headers: { "x-api-key": apiKey },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ detail: "Respons tidak valid dari server." }));
        throw new Error(
          `Error ${response.status}: ${errorData.detail || response.statusText}`
        );
      }

      const result = await response.json();
      console.log(result);
      const summary = result.response || "API tidak mengembalikan ringkasan.";
      displaySummaryStatus("summary", summary);
    } catch (error) {
      console.error("Kesalahan API:", error);
      displaySummaryStatus("error", error.message);
    } finally {
      setControlsDisabled(false);
    }
  }
});
