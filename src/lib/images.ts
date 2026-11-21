/**
 * True for SVG images. They skip the `next/image` optimizer (`unoptimized`), which does not
 * process SVG unless `dangerouslyAllowSVG` is enabled.
 */
export function isSvgImage(src: string): boolean {
  return src.toLowerCase().endsWith(".svg");
}
