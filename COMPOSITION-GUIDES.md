# Artist Companion: composition guide requirements

Build these features independently from this specification, using standard
mathematical and artistic principles. Write original implementation code and
original instructional text. Use only this project's files and public
documentation as implementation inputs.

The descriptions below specify intended functionality, not fixed layouts.
For an artistic principle without a unique mathematical construction, design
an adjustable schematic and explain its interpretation. Present every guide
as an optional aid, with the artist choosing what suits their intention.

| # | Guide | Intended functionality |
| --- | --- | --- |
| 1 | Rule of Thirds | Divide the paper into nine equal areas and identify the four internal intersections. |
| 2 | Golden Ratio | Offer horizontal and vertical divisions based on the golden proportion. |
| 3 | Golden Spiral | Provide an orientable spiral for exploring how attention travels toward a focal region. |
| 4 | Nested Halves | Show successive half-sheet divisions for planning studies at different scales. |
| 5 | Root Rectangle | Illustrate a square-diagonal construction and its relationship to the selected paper ratio. |
| 6 | Rabatment | Mark the squares that can be constructed from the rectangle's shorter dimension. |
| 7 | Radial Burst | Let the artist position a common origin and adjust a set of radiating directions. |
| 8 | Steelyard | Provide an asymmetric balance study with adjustable dominant and supporting areas. |
| 9 | Diagonal Method | Construct corner-based 45-degree directions using the paper's physical proportions. |
| 10 | Dynamic Symmetry | Offer a geometric framework of rectangle diagonals and perpendicular relationships. |
| 11 | Golden Triangle | Show a main diagonal with perpendicular branches from the remaining corners. |
| 12 | S-Curve | Provide a smooth, adjustable winding route for arranging forms through the composition. |
| 13 | Concentric Rings | Let the artist choose a centre and ring spacing to explore layered areas of interest. |
| 14 | Horizon Ratios | Compare alternative horizon heights and the resulting division of sky and ground. |
| 15 | Rule of Odds | Offer movable markers for experimenting with odd-numbered subject groups. |
| 16 | Quadrants | Divide the sheet at its horizontal and vertical midpoints for comparing regions. |
| 17 | Scaling Grid | Draw physically square cells at a chosen spacing, allowing partial cells at the edges. |
| 18 | One-Point Room | Construct an interior study with a back plane and edges directed toward one vanishing point. |
| 19 | One-Point Depth | Demonstrate projected equal-distance intervals on a receding plane with stated viewing assumptions. |
| 20 | Two-Point Perspective | Provide a horizon and two vanishing points for studying forms seen around a corner. |
| 21 | Three-Point Perspective | Add a third convergence direction for views tilted upward or downward. |
| 22 | One-Point Perspective | Provide a movable horizon, vanishing point and directional construction lines. |
| 23 | Alignment | Let the artist place shared axes and baselines to compare the placement of separate elements. |
| 24 | Visual Balance | Provide adjustable comparison regions for considering mass and negative space, without claiming an automatic balance score. |
| 25 | Visual Hierarchy | Offer editable primary, secondary and supporting zones to plan an order of attention. |
| 26 | White Space | Mark adjustable margins and reserved empty regions around subjects. |
| 27 | Rhythm | Explore repeated forms with adjustable spacing, size and progression. |
| 28 | Movement | Let the artist lay out a directional viewing path, with optional path presets. |
| 29 | Emphasis | Mark a chosen focal area and its surrounding separation from other elements. |
| 30 | Proximity | Explore grouping by adjusting distances within and between sets of markers. |

## Shared behavior

- Generate geometry from the selected paper dimensions or declared aspect ratio.
- Map paper coordinates onto a photographed surface with a four-corner homography.
- Keep mathematical geometry separate from browser rendering and interaction.
- Provide visibility, opacity and relevant adjustments without losing calibration.
- Keep the original photograph unchanged.
- Validate mathematical constructions and label illustrative schematics clearly.
- Choose implementation identifiers for Artist Companion; no external identifier
  compatibility is required.
