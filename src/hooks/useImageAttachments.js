import { useRef, useState } from "react";
import { validateImage, processImage, hashImage } from "../lib/image-processor";
import {
  isConvertibleDocument,
  convertDocument,
  validateDocument,
  formatAsAttachment,
} from "../lib/document-processor";

export function useImageAttachments({
  attachedFiles,
  setAttachedFiles,
  imageSupportConfig,
  showToast,
  attachFile,
  dragCounter,
  setDragging,
}) {
  const [showImagePrivacyWarning, setShowImagePrivacyWarning] = useState(false);
  const [processingImages, setProcessingImages] = useState(0);
  const [convertingDoc, setConvertingDoc] = useState(null);
  const processingQueue = useRef([]);
  const activeProcessing = useRef(new Set());
  const nextProcessingId = useRef(1);
  const MAX_CONCURRENT_PROCESSING = 3;
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  function checkAndShowImagePrivacyWarning() {
    const hasSeenWarning =
      localStorage.getItem("cc-image-privacy-accepted") === "true";
    if (!hasSeenWarning) {
      setShowImagePrivacyWarning(true);
      return true;
    }
    return false;
  }

  async function queueImageProcessing(file, config) {
    return new Promise((resolve, reject) => {
      const processingId = nextProcessingId.current++;
      processingQueue.current.push({
        processingId,
        file,
        config,
        resolve,
        reject,
      });
      processNextInQueue();
    });
  }

  async function processNextInQueue() {
    if (activeProcessing.current.size >= MAX_CONCURRENT_PROCESSING) return;
    if (processingQueue.current.length === 0) return;

    const { processingId, file, config, resolve, reject } =
      processingQueue.current.shift();
    activeProcessing.current.add(processingId);
    setProcessingImages((prev) => prev + 1);

    try {
      const result = await processImage(file, config);
      resolve(result);
    } catch (err) {
      reject(err);
    } finally {
      activeProcessing.current.delete(processingId);
      setProcessingImages((prev) => prev - 1);
      processNextInQueue();
    }
  }

  function openLightbox(imageIndex) {
    const imageFiles = attachedFiles.filter(
      (f) => f.type === "image" || f.isImage,
    );
    if (imageIndex >= 0 && imageIndex < imageFiles.length) {
      const img = imageFiles[imageIndex];
      setLightboxImage({ src: img.thumbnail, filename: img.name });
      setLightboxIndex(imageIndex);
      setLightboxOpen(true);
    }
  }

  function openLightboxFromMessage(imageBase64, filename, allImages, index) {
    const src = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;
    setLightboxImage({ src, filename });
    setLightboxIndex(index || 0);
    setLightboxOpen(true);
  }

  function closeLightbox() {
    setLightboxOpen(false);
    setLightboxImage(null);
  }

  function navigateLightbox(newIndex) {
    const imageFiles = attachedFiles.filter(
      (f) => f.type === "image" || f.isImage,
    );
    if (newIndex >= 0 && newIndex < imageFiles.length) {
      const img = imageFiles[newIndex];
      setLightboxImage({ src: img.thumbnail, filename: img.name });
      setLightboxIndex(newIndex);
    }
  }

  async function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    for (const file of files) {
      if (isConvertibleDocument(file)) {
        const validation = validateDocument(file);
        if (!validation.valid) {
          alert(validation.error);
          continue;
        }
        setConvertingDoc(file.name);
        try {
          const result = await convertDocument(file);
          const attachment = formatAsAttachment(result, file);
          setAttachedFiles((prev) => [...prev, attachment]);
        } catch (err) {
          alert(`Failed to convert "${file.name}": ${err.message}`);
        } finally {
          setConvertingDoc(null);
        }
        continue;
      }

      if (file.type.startsWith("image/")) {
        const shouldWait = checkAndShowImagePrivacyWarning();
        if (shouldWait) continue;
        try {
          const imgCfg = imageSupportConfig || {};
          const validation = await validateImage(file, imgCfg);
          if (!validation.valid) {
            showToast(`❌ ${file.name}: ${validation.error}`);
            continue;
          }
          const processed = await queueImageProcessing(file, imgCfg);
          const hash = await hashImage(processed.base64);
          const isDuplicate = attachedFiles.some((f) => f.hash === hash);
          if (isDuplicate) {
            const proceed = confirm(
              `${file.name} appears to be a duplicate. Attach anyway?`,
            );
            if (!proceed) continue;
          }
          attachFile({
            name: file.name,
            content: processed.base64,
            type: "image",
            isImage: true,
            thumbnail: processed.thumbnail,
            size: processed.size,
            dimensions: processed.dimensions,
            format: processed.format,
            hash,
          });
        } catch (err) {
          const msg = err.message.toLowerCase();
          if (msg.includes("dimension")) {
            showToast(`❌ ${file.name}: Image too large to process`);
          } else if (msg.includes("canvas") || msg.includes("context")) {
            showToast(
              `❌ ${file.name}: Failed to process image (browser error)`,
            );
          } else if (msg.includes("memory") || msg.includes("out of")) {
            showToast("❌ Out of memory. Try smaller images or fewer at once.");
          } else if (msg.includes("corrupt") || msg.includes("invalid")) {
            showToast(`❌ ${file.name}: Corrupted or invalid image file`);
          } else {
            showToast(`❌ ${file.name}: ${err.message}`);
          }
        }
      } else {
        const reader = new FileReader();
        reader.onload = (ev) => {
          attachFile({
            name: file.name,
            content: ev.target.result,
            lines: ev.target.result.split("\n").length,
            type: "text",
          });
        };
        reader.readAsText(file);
      }
    }
    e.target.value = "";
  }

  async function handleDrop(e) {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);

    for (const file of files) {
      if (file.size === 0 && file.type === "") continue;

      if (isConvertibleDocument(file)) {
        const validation = validateDocument(file);
        if (!validation.valid) continue;
        setConvertingDoc(file.name);
        try {
          const result = await convertDocument(file);
          const attachment = formatAsAttachment(result, file);
          setAttachedFiles((prev) => [...prev, attachment]);
        } catch (err) {
          console.error("Document conversion failed:", err);
        } finally {
          setConvertingDoc(null);
        }
        continue;
      }

      if (file.type.startsWith("image/")) {
        const shouldWait = checkAndShowImagePrivacyWarning();
        if (shouldWait) continue;
        try {
          const imgCfg = imageSupportConfig || {};
          const validation = await validateImage(file, imgCfg);
          if (!validation.valid) {
            showToast(`❌ ${file.name}: ${validation.error}`);
            continue;
          }
          const processed = await queueImageProcessing(file, imgCfg);
          const hash = await hashImage(processed.base64);
          const isDuplicate = attachedFiles.some((f) => f.hash === hash);
          if (isDuplicate) {
            const proceed = confirm(
              `${file.name} appears to be a duplicate. Attach anyway?`,
            );
            if (!proceed) continue;
          }
          attachFile({
            name: file.name,
            content: processed.base64,
            type: "image",
            isImage: true,
            thumbnail: processed.thumbnail,
            size: processed.size,
            dimensions: processed.dimensions,
            format: processed.format,
            hash,
          });
        } catch (err) {
          const msg = err.message.toLowerCase();
          if (msg.includes("dimension")) {
            showToast(`❌ ${file.name}: Image too large to process`);
          } else if (msg.includes("canvas") || msg.includes("context")) {
            showToast(
              `❌ ${file.name}: Failed to process image (browser error)`,
            );
          } else if (msg.includes("memory") || msg.includes("out of")) {
            showToast("❌ Out of memory. Try smaller images or fewer at once.");
          } else if (msg.includes("corrupt") || msg.includes("invalid")) {
            showToast(`❌ ${file.name}: Corrupted or invalid image file`);
          } else {
            showToast(`❌ ${file.name}: ${err.message}`);
          }
        }
      } else {
        const reader = new FileReader();
        reader.onload = (ev) => {
          attachFile({
            name: file.name,
            content: ev.target.result,
            lines: ev.target.result.split("\n").length,
            type: "text",
          });
        };
        reader.readAsText(file);
      }
    }
  }

  async function handlePasteImage(e) {
    const items = Array.from(e.clipboardData?.items || []);
    for (const item of items) {
      if (!item.type.startsWith("image/")) continue;
      e.preventDefault();
      const file = item.getAsFile();
      if (!file) continue;

      const shouldWait = checkAndShowImagePrivacyWarning();
      if (shouldWait) continue;

      try {
        const imgCfg = imageSupportConfig || {};
        const validation = await validateImage(file, imgCfg);
        if (!validation.valid) {
          showToast(`❌ Pasted image: ${validation.error}`);
          continue;
        }
        const processed = await queueImageProcessing(file, imgCfg);
        const hash = await hashImage(processed.base64);
        const isDuplicate = attachedFiles.some((f) => f.hash === hash);
        if (isDuplicate) {
          const proceed = confirm(
            "This image appears to be a duplicate. Attach anyway?",
          );
          if (!proceed) continue;
        }
        attachFile({
          name: file.name || `pasted-image-${Date.now()}.png`,
          content: processed.base64,
          type: "image",
          isImage: true,
          thumbnail: processed.thumbnail,
          size: processed.size,
          dimensions: processed.dimensions,
          format: processed.format,
          hash,
        });
        showToast("✓ Image pasted from clipboard");
      } catch (err) {
        const msg = err.message.toLowerCase();
        if (msg.includes("dimension")) {
          showToast("❌ Pasted image too large to process");
        } else if (msg.includes("canvas") || msg.includes("context")) {
          showToast("❌ Failed to process pasted image (browser error)");
        } else if (msg.includes("memory") || msg.includes("out of")) {
          showToast("❌ Out of memory. Try a smaller image.");
        } else if (msg.includes("corrupt") || msg.includes("invalid")) {
          showToast("❌ Corrupted or invalid pasted image");
        } else {
          showToast(`❌ Failed to process pasted image: ${err.message}`);
        }
      }
    }
  }

  return {
    showImagePrivacyWarning,
    setShowImagePrivacyWarning,
    processingImages,
    convertingDoc,
    lightboxOpen,
    lightboxImage,
    lightboxIndex,
    openLightbox,
    openLightboxFromMessage,
    closeLightbox,
    navigateLightbox,
    handleFileUpload,
    handleDrop,
    handlePasteImage,
  };
}
