type Call = readonly [string, ...unknown[]];

/**
 * A CanvasRenderingContext2D stand-in that records the call sequence.
 *
 * canvas.ts's only real logic is dispatching OpSets onto a context, so recording
 * the calls tests it exactly -- with no native `canvas` package, no browser, and
 * no pixels. Property assignments (strokeStyle, lineWidth, ...) are recorded too,
 * via setters, because the fill/stroke styling is part of the contract.
 */
export function recordingCanvas(): { canvas: HTMLCanvasElement; calls: Call[] } {
  const calls: Call[] = [];
  const rec =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push([name, ...args]);
    };

  const ctx = {
    save: rec('save'),
    restore: rec('restore'),
    beginPath: rec('beginPath'),
    closePath: rec('closePath'),
    moveTo: rec('moveTo'),
    lineTo: rec('lineTo'),
    bezierCurveTo: rec('bezierCurveTo'),
    stroke: rec('stroke'),
    fill: rec('fill'),
    setLineDash: rec('setLineDash'),
    set strokeStyle(v: string) {
      calls.push(['strokeStyle', v]);
    },
    set fillStyle(v: string) {
      calls.push(['fillStyle', v]);
    },
    set lineWidth(v: number) {
      calls.push(['lineWidth', v]);
    },
    set lineDashOffset(v: number) {
      calls.push(['lineDashOffset', v]);
    },
  };

  const canvas = {
    width: 400,
    height: 400,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;

  return { canvas, calls };
}

/** The fill rule the canvas backend actually used, defaulting as the DOM does. */
export function canvasFillRule(calls: Call[]): string {
  const fill = calls.find((c) => c[0] === 'fill');
  return (fill?.[1] as string | undefined) ?? 'nonzero';
}
