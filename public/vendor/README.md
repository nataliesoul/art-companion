# Vendored p5.js

- `p5.min.js`: p5.js 1.11.3, downloaded from
  https://cdn.jsdelivr.net/npm/p5@1.11.3/lib/p5.min.js (1,056,654 bytes).
- `p5-license.txt`: the library's LGPL-2.1 license text, from the same
  package. Keep it alongside the bundle.

Used only by the section 10 suggestion overlay (`renderAnnotations` in
`../app.js`, instance mode). Everything else stays dependency-free.
To upgrade, replace both files and re-run the section 10 checks in
`../../TESTING.md`.
