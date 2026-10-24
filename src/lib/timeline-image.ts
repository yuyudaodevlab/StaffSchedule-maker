import { toPng } from "html-to-image";

export type CaptureRegion = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Tile the content area, repeating the fixed time and hierarchy headers. */
export function timelineRegions(
  width: number,
  height: number,
  headerWidth: number,
  headerHeight: number,
): CaptureRegion[] {
  const bodyWidth = 3600 - headerWidth;
  const bodyHeight = 2000 - headerHeight;
  const result: CaptureRegion[] = [];
  for (let top = 0; top < height - headerHeight; top += bodyHeight) {
    for (let left = 0; left < width - headerWidth; left += bodyWidth) {
      result.push({
        left,
        top,
        width: Math.min(3600, width - left),
        height: Math.min(2000, height - top),
      });
      if (result.length > 100)
        throw new Error(
          "画像が100枚を超えます。日付や会場を絞るか、ズームを小さくしてください。",
        );
    }
  }
  return result;
}

export async function captureTimeline(
  canvas: HTMLElement,
  region: CaptureRegion,
  vertical: boolean,
  scale: number,
): Promise<string> {
  const host = document.createElement("div");
  host.className = vertical ? "vertical" : "";
  Object.assign(host.style, {
    position: "fixed",
    left: "0",
    transform: "translateX(-20000px)",
    top: "0",
    width: `${region.width}px`,
    height: `${region.height}px`,
    overflow: "hidden",
    background: getComputedStyle(canvas).backgroundColor,
    pointerEvents: "none",
  });
  const clone = canvas.cloneNode(true) as HTMLElement;
  clone.style.transform = `translate(${-region.left}px, ${-region.top}px)`;
  clone.querySelectorAll(".resize-handle").forEach((el) => el.remove());
  host.append(clone);
  canvas.parentElement!.append(host);
  try {
    return await toPng(host, {
      width: region.width,
      height: region.height,
      pixelRatio: scale,
      skipFonts: true,
      style: { transform: "none" },
    });
  } finally {
    host.remove();
  }
}
