# Third-party notices

`@drietsch/sketch` is distributed as a single bundled ES module with no
runtime dependencies. The following third-party code and data are compiled
into `dist/`, and their notices are reproduced here as their licenses require.

- [roughjs](#roughjs) and four small libraries it uses: the sketch engine (MIT)
- [Handodle](#handodle): the default font, as its drawn outlines (Putracetol Studio, commercial licence)
- [Hershey Fonts](#hershey-fonts): not in the bundle any more, still in the repository (permissive use restriction)
- [sketchyicons](#sketchyicons), derived from Lucide and Feather: the built-in icons (MIT / ISC / MIT)

The published bundle is not minified and comments are preserved, so the code
below is also identifiable in `dist/index.js`.

---

## roughjs

The sketch-geometry engine in `src/sketch/` is derived from
[roughjs](https://github.com/rough-stuff/rough).

```
MIT License

Copyright (c) 2019 Preet Shihn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Bundled dependencies

All four are MIT licensed, © Preet Shihn.

| Package            | Version | Source                                     |
| ------------------ | ------- | ------------------------------------------ |
| `hachure-fill`     | 0.5.2   | https://github.com/pshihn/hachure-fill     |
| `path-data-parser` | 0.1.0   | https://github.com/pshihn/path-data-parser |
| `points-on-curve`  | 0.2.0   | https://github.com/pshihn/points-on-curve  |
| `points-on-path`   | 0.2.1   | https://github.com/pshihn/points-on-path   |

Each carries the MIT license text reproduced above, with copyright held by
Preet Shihn.

---

## Handodle

The default font, `src/text/fonts/handodle.ts`, is derived from Handodle by
Putra Novembria Candra Kusuma (Putracetol Studio), ©2019, converted from
`vendor/handodle/Handodle-Regular.ttf` by `scripts/gen-outline-font.mjs`:
the letters as the face's own outlines, thinned to what shows on screen. It
is drawn in capitals only, so the lower-case glyphs are not included.

The font's own licence field reads: "please refer to the license on the
website where you bought this font. if you need an extended license, please
contact the creator." (https://creativemarket.com/licenses/terms/general).
The file converted here is the studio's demo build (subfamily "Free"), in
which the digits and the marks `? ( ) ! % & @ # $ * < > ^ { }` are a "personal
use" tile rather than glyphs; those 25 characters, and `ß · ± ™ ‹ › ‚`, the arrows and the check marks,
which the face has no glyph for, are written by hand in this repository and
are not part of the font. Whoever redistributes this package is responsible
for holding a licence that covers it.

---

## sketchyicons

The built-in icons (`src/icons/builtin.ts`) are copied from
[`@sketchyicons/data`](https://github.com/Fantomiald/sketchyicons), whose
code is MIT licensed and whose geometry is derived from Lucide (ISC) and, for
some icons, Feather (MIT). sketch is not affiliated with sketchyicons,
Lucide or Feather.

```
MIT License

Copyright (c) 2026 Julien Montagne

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Lucide

```
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

### Feather

The following built-in icons are Lucide icons derived from the Feather
project: arrow-left, arrow-right, calendar, check, chevron-down,
chevron-left, chevron-right, chevron-up, download, info, lock, log-in,
log-out, minus, plus, search, trash-2, upload, x.

```
The MIT License (MIT)

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
