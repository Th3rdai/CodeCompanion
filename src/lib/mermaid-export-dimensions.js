const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;

function parsePixelDimension(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/%$/.test(raw)) return null;
  const match = raw.match(/^([\d.]+)(px)?$/i);
  if (!match) return null;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseViewBoxDimensions(viewBox) {
  if (!viewBox) return { width: null, height: null };
  const parts = String(viewBox)
    .trim()
    .split(/[\s,]+/)
    .map((part) => Number.parseFloat(part));
  const width = Number.isFinite(parts[2]) && parts[2] > 0 ? parts[2] : null;
  const height = Number.isFinite(parts[3]) && parts[3] > 0 ? parts[3] : null;
  return { width, height };
}

function parseStyleDimensions(styleText) {
  const style = String(styleText || "");
  const read = (propName) => {
    const regex = new RegExp(`${propName}\\s*:\\s*([\\d.]+)px`, "i");
    const match = style.match(regex);
    if (!match) return null;
    const parsed = Number.parseFloat(match[1]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };
  return {
    maxWidth: read("max-width"),
    width: read("width"),
    maxHeight: read("max-height"),
    height: read("height"),
  };
}

function pickRatio({ viewBoxWidth, viewBoxHeight, attrWidth, attrHeight, styleWidth, styleHeight }) {
  if (viewBoxWidth && viewBoxHeight) return viewBoxWidth / viewBoxHeight;
  if (attrWidth && attrHeight) return attrWidth / attrHeight;
  if (styleWidth && styleHeight) return styleWidth / styleHeight;
  return null;
}

export function resolveSvgExportDimensions({
  widthAttr,
  heightAttr,
  viewBoxAttr,
  styleAttr,
  defaultWidth = DEFAULT_WIDTH,
  defaultHeight = DEFAULT_HEIGHT,
} = {}) {
  const attrWidth = parsePixelDimension(widthAttr);
  const attrHeight = parsePixelDimension(heightAttr);
  const { width: viewBoxWidth, height: viewBoxHeight } = parseViewBoxDimensions(viewBoxAttr);
  const styleDims = parseStyleDimensions(styleAttr);
  const styleWidth = styleDims.maxWidth || styleDims.width;
  const styleHeight = styleDims.maxHeight || styleDims.height;

  let width = attrWidth;
  let height = attrHeight;

  // If attributes are missing/unresolved (e.g. 100%), prefer viewBox before style.
  if (!width) width = viewBoxWidth || styleWidth;
  if (!height) height = viewBoxHeight || styleHeight;

  const discoveredRatio = pickRatio({
    viewBoxWidth,
    viewBoxHeight,
    attrWidth,
    attrHeight,
    styleWidth,
    styleHeight,
  });
  const ratio = discoveredRatio || defaultWidth / defaultHeight;

  if (!width && !height) {
    return { width: defaultWidth, height: defaultHeight };
  }
  if (!width) {
    width = ratio ? height * ratio : defaultWidth;
  }
  if (!height) {
    height = ratio ? width / ratio : defaultHeight;
  }

  const finalWidth =
    Number.isFinite(width) && width > 0 ? width : defaultWidth;
  const finalHeight =
    Number.isFinite(height) && height > 0 ? height : defaultHeight;

  return { width: finalWidth, height: finalHeight };
}
