# Artist Companion — working name

This project is separate from the owner's existing Art Guide project on Specs.
Use Artist Companion as a provisional, descriptive product name. The owner may
rename it later. Do not reuse ArtGuide AI as the product name.

Suggested description: Composition guides and thoughtful feedback for physical art.

When implementing, keep the display name and description in one shared branding
configuration. Keep storage keys, project IDs and data formats independent of the
display name so a later rename does not affect saved artwork or projects.

## Purpose

Help artists plan compositions, develop ideas, and receive constructive feedback
while working with physical media. Artists control their intentions and decide
whether to use any suggestion. Guidelines are optional, not aesthetic rules.

## Devices and development environment

- Develop on Windows in E:\Dev\MUSE using Muse Code.
- First mobile test device: iPhone 17 Pro Max running Safari.
- Also support iPad and Windows browsers.
- Test an immersive browser experience on the owner's Meta Quest 3 early.
- The owner also has Ray-Ban Meta glasses; exact model is unconfirmed and
  integration is outside the first milestone.
- No Mac is available. Prefer a web workflow that does not require Xcode.

## Goal

A useful personal prototype that can become a polished presentation/demo.
Share project data and artwork coordinates across device-specific views.
Cross-platform does not imply identical camera or immersive capabilities.

## Milestone 1: browser feasibility

1. Create a small responsive capability-test page with photo upload.
2. Request camera access only after a user action. Show a preview and capture
   a still image when supported. Provide useful errors and upload fallback.
3. Allow the artist to mark four corners of one flat rectangular artwork in a
   captured image and show an adjustable guide. Keep the original image intact.
4. Save and reopen a local project. Offer explicit export/import for transfer
   between devices; browser-local storage alone does not provide synchronization.
5. Add a small Quest browser test for immersive AR and manual placement of a
   rectangle over a stationary physical sheet. Check support on the real device.
6. Measure visible alignment drift as the viewpoint changes. Recalibrate after
   moving the artwork. Do not promise arbitrary surface or moving-camera tracking.
7. Test whether the actual Quest browser exposes physical camera frames. Rendering
   passthrough does not prove camera images are accessible to the application.

Done when: iPhone photo capture/upload and guide placement work, a project can be
reopened/transferred, and the real Quest test has recorded capability/alignment
results. Desktop-only checks are not evidence of success on iPhone or Quest.

## Later milestones

2. Artist workflow: artistic intention, medium, reference import, thirds grid,
   centerlines, adjustable opacity, hide/lock controls, saved projects.
3. Critique on request: crop and rectify artwork before analysis; include intent,
   medium and chosen feedback topic; return strengths, up to three observations,
   optional next steps, and uncertainty. Start with composition and values.
4. Visual suggestions: editable annotations first; generated alternatives later.
   Preserve original artwork and keep every suggestion dismissible.
5. Continuity and demo: selected snapshots and decisions inform later feedback;
   polish one complete painting session for presentation.

## Architecture direction

- A responsive web interface plus an immersive Quest view.
- Reuse project schemas and artwork-space coordinates across views.
- A backend calls Meta Model API; never embed provider keys in browser code.
- Muse Code is the development assistant. Runtime model API access is a separate
  setup step and is not established by installing or signing into Muse Code.
- Choose persistence and authenticated synchronization after the feasibility test.
- Plan an HTTPS test address for physical mobile devices. A phone's localhost is
  the phone itself; a Windows LAN HTTP address generally cannot enable camera/XR.
- Test artwork analysis quality and generated-image fidelity; do not assume model
  support establishes usefulness or precise geometry.

## Sources checked 2026-10-28

- https://dev.meta.ai/docs/muse-code
- https://dev.meta.ai/docs/muse-code/configuration
- https://dev.meta.ai/docs/image-understanding
- https://dev.meta.ai/docs/models
- https://developers.meta.com/horizon/documentation/web/webxr-mixed-reality
- https://developers.meta.com/vr/documentation/iwsdk/guides/13-camera-access/
- https://developers.meta.com/horizon/documentation/unity/unity-pca-overview

The older WebXR passthrough page and newer generic browser camera documentation
do not resolve actual physical camera availability on the user's Quest. Verify
on device before making that a dependency.
