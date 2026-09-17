/**
 * One SVG child element of an icon: its tag and attributes. This is the shape
 * `@sketchyicons/data` exports, so any of its icons can be passed straight in.
 */
export type IconElement = [tag: string, attrs: Record<string, string | number>];

export interface IconDef {
  /** Defaults to '0 0 24 24'. */
  viewBox?: string;
  nodes: IconElement[];
  /**
   * Run the geometry through the sketch engine. Off by default because the
   * built-in icons are already hand-drawn; turn on for clean paths.
   */
  rough?: boolean;
}
