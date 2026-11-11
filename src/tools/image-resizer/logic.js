// Common sizes. Social networks change their recommendations now and then; these are the
// long-standing ones.
export const PRESETS = [
  { id: 'custom', label: 'Custom size' },
  { id: 'web', label: 'Website image: 1600 wide', width: 1600, height: '', fit: 'fit' },
  { id: 'email', label: 'Email attachment: 1200 wide', width: 1200, height: '', fit: 'fit' },
  { id: 'thumb', label: 'Thumbnail: 300 wide', width: 300, height: '', fit: 'fit' },
  { id: 'ig-square', label: 'Instagram square post: 1080 × 1080', width: 1080, height: 1080, fit: 'cover' },
  { id: 'ig-portrait', label: 'Instagram portrait post: 1080 × 1350', width: 1080, height: 1350, fit: 'cover' },
  { id: 'story', label: 'Story or Reel (9:16): 1080 × 1920', width: 1080, height: 1920, fit: 'cover' },
  { id: 'youtube', label: 'YouTube thumbnail: 1280 × 720', width: 1280, height: 720, fit: 'cover' },
  { id: 'full-hd', label: 'Full HD (16:9): 1920 × 1080', width: 1920, height: 1080, fit: 'cover' },
];

/** Do the current width/height/fit still match the chosen preset? */
export function presetMatches(id, o) {
  const p = PRESETS.find((x) => x.id === id);
  if (!p || !p.width) return id === 'custom';
  return Number(o.width) === p.width && String(o.height ?? '') === String(p.height) && o.fit === p.fit;
}
