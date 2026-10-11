import fs from 'node:fs';
import path from 'node:path';

const mediaPath = /^\/media\/[a-f0-9]{64}\.(jpg|jpeg|png|webp|gif|svg)$/;
const mimeByExtension = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' };
const dimension = value => Number.isSafeInteger(value) && value > 0 && value <= 30000;

function validAsset(originalUrl, asset) {
  const original = mediaPath.exec(originalUrl);
  const target = mediaPath.exec(asset?.url || '');
  const restoresEmbeddedRaster = asset?.sourceKind === 'svg-embedded-raster-repair'
    && original?.[1] === 'svg' && target?.[1] === 'svg'
    && asset.width === asset.sourceWidth && asset.height === asset.sourceHeight;
  return original && target && asset.url !== originalUrl && asset.mime === mimeByExtension[target[1]]
    && ['width', 'height', 'sourceWidth', 'sourceHeight'].every(key => dimension(asset[key]))
    && asset.width * asset.height <= 150000000
    && asset.width >= asset.sourceWidth && asset.height >= asset.sourceHeight
    && (asset.sourceKind === 'svg-embedded-raster-repair'
      ? restoresEmbeddedRaster
      : asset.width > asset.sourceWidth || asset.height > asset.sourceHeight);
}

// Catalog source identity stays immutable. This map only selects a verified,
// larger copy of the same original illustration, or a same-geometry SVG whose
// original embedded raster has been recovered by the trusted repair process.
export function createAssetQualityStore({ dataDir }) {
  const filename = path.join(dataDir, 'media-quality.json');
  let signature = null;
  let assets = new Map();

  function currentAssets() {
    try {
      const stat = fs.statSync(filename);
      const nextSignature = `${stat.mtimeMs}:${stat.ctimeMs}:${stat.size}`;
      if (nextSignature === signature) return assets;
      const value = JSON.parse(fs.readFileSync(filename, 'utf8'));
      const next = new Map();
      if (value?.version === 1 && value.assets && !Array.isArray(value.assets) && typeof value.assets === 'object') {
        for (const [originalUrl, asset] of Object.entries(value.assets)) {
          if (validAsset(originalUrl, asset)) next.set(originalUrl, asset);
        }
      }
      signature = nextSignature;
      assets = next;
    } catch {
      // A missing or invalid override must never prevent the original from loading.
      signature = null;
      assets = new Map();
    }
    return assets;
  }

  function apply(media, map) {
    const asset = map.get(media.url);
    if (!asset || asset.sourceWidth !== media.width || asset.sourceHeight !== media.height) return media;
    if (asset.sourceKind === 'svg-embedded-raster-repair' && media.mime !== 'image/svg+xml') return media;
    try {
      if (!fs.statSync(path.join(dataDir, asset.url.slice(1))).isFile()) return media;
    } catch { return media; }
    return {
      ...media,
      originalUrl: media.url,
      url: asset.url,
      mime: asset.mime,
      width: asset.width,
      height: asset.height,
      sourceWidth: media.width,
      sourceHeight: media.height,
      quality: asset.sourceKind === 'svg-embedded-raster-repair' ? 'restored-source' : 'native-source',
    };
  }

  return {
    resolve(media) { return apply(media, currentAssets()); },
    resolveAll(media) { const map = currentAssets(); return media.map(item => apply(item, map)); },
  };
}
