import type { Options, Drawable, OpSet, Op, ResolvedOptions, PathInfo } from './core.js';
import type { Point } from './geometry.js';
import { roundedRectPath } from './geometry.js';
import {
  line,
  solidFillPolygon,
  patternFillPolygons,
  rectangle,
  ellipseWithParams,
  generateEllipseParams,
  linearPath,
  arc,
  patternFillArc,
  curve,
  svgPath,
} from './renderer.js';
import { randomSeed } from './math.js';
import { curveToBezier } from 'points-on-curve/lib/curve-to-bezier.js';
import { pointsOnBezierCurves } from 'points-on-curve';
import { pointsOnPath } from 'points-on-path';

const NOS = 'none';

export class RoughGenerator {
  defaultOptions: ResolvedOptions = {
    maxRandomnessOffset: 2,
    roughness: 1,
    bowing: 1,
    stroke: '#000',
    strokeWidth: 1,
    curveTightness: 0,
    curveFitting: 0.95,
    curveStepCount: 9,
    fillStyle: 'hachure',
    fillWeight: -1,
    hachureAngle: -41,
    hachureGap: -1,
    dashOffset: -1,
    dashGap: -1,
    zigzagOffset: -1,
    seed: 0,
    disableMultiStroke: false,
    disableMultiStrokeFill: false,
    preserveVertices: false,
    fillShapeRoughnessGain: 0.8,
  };

  constructor(options?: Options) {
    if (options) {
      this.defaultOptions = this._o(options);
    }
    // Materialise a concrete seed once, so that a generator created without one
    // still produces reproducible drawings and reports the seed that made them.
    // Previously the default seed of 0 made Random fall back to Math.random on
    // every draw, so nothing drawn with default options could be reproduced.
    if (!this.defaultOptions.seed) {
      this.defaultOptions.seed = randomSeed();
    }
  }

  static newSeed(): number {
    return randomSeed();
  }

  private _o(options?: Options): ResolvedOptions {
    // Always a fresh object, never this.defaultOptions by reference. renderer.ts
    // lazily attaches a `randomizer` to whatever it is handed, so returning the
    // shared defaults let one mutable random stream accumulate across every call
    // made without an options argument -- while calls made WITH options got a
    // fresh stream. Identical arguments therefore produced different drawings
    // depending on whether an options object was passed at all.
    return Object.assign({}, this.defaultOptions, options);
  }

  private _d(shape: string, sets: OpSet[], options: ResolvedOptions): Drawable {
    return { shape, sets: sets || [], options: options || this.defaultOptions };
  }

  line(x1: number, y1: number, x2: number, y2: number, options?: Options): Drawable {
    const o = this._o(options);
    return this._d('line', [line(x1, y1, x2, y2, o)], o);
  }

  rectangle(x: number, y: number, width: number, height: number, options?: Options): Drawable {
    const o = this._o(options);
    const paths = [];
    const outline = rectangle(x, y, width, height, o);
    if (o.fill) {
      const points: Point[] = [
        [x, y],
        [x + width, y],
        [x + width, y + height],
        [x, y + height],
      ];
      if (o.fillStyle === 'solid') {
        paths.push(solidFillPolygon([points], o));
      } else {
        paths.push(patternFillPolygons([points], o));
      }
    }
    if (o.stroke !== NOS) {
      paths.push(outline);
    }
    return this._d('rectangle', paths, o);
  }

  roundedRectangle(x: number, y: number, width: number, height: number, radius: number, options?: Options): Drawable {
    if (!(radius > 0)) {
      return this.rectangle(x, y, width, height, options);
    }
    const ret = this.path(roundedRectPath(x, y, width, height, radius), options);
    ret.shape = 'roundedRectangle';
    return ret;
  }

  ellipse(x: number, y: number, width: number, height: number, options?: Options): Drawable {
    const o = this._o(options);
    const paths: OpSet[] = [];
    const ellipseParams = generateEllipseParams(width, height, o);
    const ellipseResponse = ellipseWithParams(x, y, o, ellipseParams);
    if (o.fill) {
      if (o.fillStyle === 'solid') {
        const shape = ellipseWithParams(x, y, o, ellipseParams).opset;
        shape.type = 'fillPath';
        paths.push(shape);
      } else {
        paths.push(patternFillPolygons([ellipseResponse.estimatedPoints], o));
      }
    }
    if (o.stroke !== NOS) {
      paths.push(ellipseResponse.opset);
    }
    return this._d('ellipse', paths, o);
  }

  circle(x: number, y: number, diameter: number, options?: Options): Drawable {
    const ret = this.ellipse(x, y, diameter, diameter, options);
    ret.shape = 'circle';
    return ret;
  }

  linearPath(points: Point[], options?: Options): Drawable {
    const o = this._o(options);
    return this._d('linearPath', [linearPath(points, false, o)], o);
  }

  arc(
    x: number,
    y: number,
    width: number,
    height: number,
    start: number,
    stop: number,
    closed: boolean = false,
    options?: Options,
  ): Drawable {
    const o = this._o(options);
    const paths = [];
    const outline = arc(x, y, width, height, start, stop, closed, true, o);
    if (closed && o.fill) {
      if (o.fillStyle === 'solid') {
        const fillOptions: ResolvedOptions = { ...o };
        fillOptions.disableMultiStroke = true;
        const shape = arc(x, y, width, height, start, stop, true, false, fillOptions);
        shape.type = 'fillPath';
        paths.push(shape);
      } else {
        paths.push(patternFillArc(x, y, width, height, start, stop, o));
      }
    }
    if (o.stroke !== NOS) {
      paths.push(outline);
    }
    return this._d('arc', paths, o);
  }

  curve(points: Point[] | Point[][], options?: Options): Drawable {
    const o = this._o(options);
    const paths: OpSet[] = [];
    const outline = curve(points, o);
    if (o.fill && o.fill !== NOS) {
      if (o.fillStyle === 'solid') {
        const fillShape = curve(points, {
          ...o,
          disableMultiStroke: true,
          roughness: o.roughness ? o.roughness + o.fillShapeRoughnessGain : 0,
        });
        paths.push({
          type: 'fillPath',
          ops: this._mergedShape(fillShape.ops),
        });
      } else {
        const polyPoints: Point[] = [];
        const inputPoints = points;
        if (inputPoints.length) {
          const p1 = inputPoints[0];
          const pointsList = typeof p1[0] === 'number' ? [inputPoints as Point[]] : (inputPoints as Point[][]);
          for (const curvePoints of pointsList) {
            if (curvePoints.length < 3) {
              polyPoints.push(...curvePoints);
            } else if (curvePoints.length === 3) {
              polyPoints.push(
                ...pointsOnBezierCurves(
                  curveToBezier([curvePoints[0], curvePoints[0], curvePoints[1], curvePoints[2]]),
                  10,
                  (1 + o.roughness) / 2,
                ),
              );
            } else {
              polyPoints.push(...pointsOnBezierCurves(curveToBezier(curvePoints), 10, (1 + o.roughness) / 2));
            }
          }
        }
        if (polyPoints.length) {
          paths.push(patternFillPolygons([polyPoints], o));
        }
      }
    }
    if (o.stroke !== NOS) {
      paths.push(outline);
    }
    return this._d('curve', paths, o);
  }

  polygon(points: Point[], options?: Options): Drawable {
    const o = this._o(options);
    const paths: OpSet[] = [];
    const outline = linearPath(points, true, o);
    if (o.fill) {
      if (o.fillStyle === 'solid') {
        paths.push(solidFillPolygon([points], o));
      } else {
        paths.push(patternFillPolygons([points], o));
      }
    }
    if (o.stroke !== NOS) {
      paths.push(outline);
    }
    return this._d('polygon', paths, o);
  }

  path(d: string, options?: Options): Drawable {
    const o = this._o(options);
    const paths: OpSet[] = [];
    if (!d) {
      return this._d('path', paths, o);
    }
    // This last replace was a string literal, not a regex, for the library's
    // entire history: '/(\s\s)/g' evaluates to the 7-character text /(ss)/g,
    // which never occurs in path data, so runs of whitespace were never collapsed.
    d = (d || '').replace(/\n/g, ' ').replace(/(-\s)/g, '-').replace(/\s\s+/g, ' ');

    const hasFill = o.fill && o.fill !== 'transparent' && o.fill !== NOS;
    const hasStroke = o.stroke !== NOS;
    const simplified = !!(o.simplification && o.simplification < 1);
    const distance = simplified ? 4 - 4 * (o.simplification || 1) : (1 + o.roughness) / 2;
    const sets = pointsOnPath(d, 1, distance);
    const shape = svgPath(d, o);

    if (hasFill) {
      if (o.fillStyle === 'solid') {
        if (sets.length === 1) {
          const fillShape = svgPath(d, {
            ...o,
            disableMultiStroke: true,
            roughness: o.roughness ? o.roughness + o.fillShapeRoughnessGain : 0,
          });
          paths.push({
            type: 'fillPath',
            ops: this._mergedShape(fillShape.ops),
          });
        } else {
          paths.push(solidFillPolygon(sets, o));
        }
      } else {
        paths.push(patternFillPolygons(sets, o));
      }
    }
    if (hasStroke) {
      if (simplified) {
        sets.forEach((set) => {
          paths.push(linearPath(set, false, o));
        });
      } else {
        paths.push(shape);
      }
    }

    return this._d('path', paths, o);
  }

  opsToPath(drawing: OpSet, fixedDecimals?: number): string {
    let path = '';
    for (const item of drawing.ops) {
      const data =
        typeof fixedDecimals === 'number' && fixedDecimals >= 0
          ? item.data.map((d) => +d.toFixed(fixedDecimals))
          : item.data;
      switch (item.op) {
        case 'move':
          path += `M${data[0]} ${data[1]} `;
          break;
        case 'bcurveTo':
          path += `C${data[0]} ${data[1]}, ${data[2]} ${data[3]}, ${data[4]} ${data[5]} `;
          break;
        case 'lineTo':
          path += `L${data[0]} ${data[1]} `;
          break;
      }
    }
    return path.trim();
  }

  toPaths(drawable: Drawable): PathInfo[] {
    const sets = drawable.sets || [];
    const o = drawable.options || this.defaultOptions;
    // Both backends forward this to opsToPath (svg.ts:66, canvas.ts:65); toPaths
    // used to drop it, so PathInfo.d ignored the option that the rendered output
    // honoured.
    const precision = o.fixedDecimalPlaceDigits;
    const paths: PathInfo[] = [];
    for (const drawing of sets) {
      let path: PathInfo | null = null;
      switch (drawing.type) {
        case 'path':
          path = {
            d: this.opsToPath(drawing, precision),
            stroke: o.stroke,
            strokeWidth: o.strokeWidth,
            fill: NOS,
          };
          break;
        case 'fillPath':
          path = {
            d: this.opsToPath(drawing, precision),
            stroke: NOS,
            strokeWidth: 0,
            fill: o.fill || NOS,
          };
          break;
        case 'fillSketch':
          path = this.fillSketch(drawing, o);
          break;
      }
      if (path) {
        paths.push(path);
      }
    }
    return paths;
  }

  private fillSketch(drawing: OpSet, o: ResolvedOptions): PathInfo {
    let fweight = o.fillWeight;
    if (fweight < 0) {
      fweight = o.strokeWidth / 2;
    }
    return {
      d: this.opsToPath(drawing, o.fixedDecimalPlaceDigits),
      stroke: o.fill || NOS,
      strokeWidth: fweight,
      fill: NOS,
    };
  }

  private _mergedShape(input: Op[]): Op[] {
    return input.filter((d, i) => {
      if (i === 0) {
        return true;
      }
      if (d.op === 'move') {
        return false;
      }
      return true;
    });
  }
}
