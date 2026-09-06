# VTracer browser runtime

Source: [visioncortex/vtracer](https://github.com/visioncortex/vtracer), npm `@visioncortex/vtracer@1.0.0-alpha.4`.

`scripts/copy-vtracer-assets.mjs` copies the pinned WASM binary and adapts its generated Node glue for browsers. The adaptation removes two CommonJS export assignments and replaces synchronous filesystem initialization with an asynchronous same-origin fetch. The algorithm and generated bindings are otherwise unchanged. A source hash prevents silently adapting a different upstream release.

The generated modules live in `public/vtracer/<version>/`, load only inside a dedicated worker, and do not use Node APIs at runtime. Each job terminates its worker after success, failure, cancellation or timeout. The dependency is MIT/Apache-2.0; the upstream MIT notice is included in this directory and copied with the served assets.

Before tracing, the app quantizes color channels into small, explicit steps. This prevents the hierarchical color clustering from merging a continuous gradient into one large region. SVG output is an approximation: small text and textures may lose detail, gradients may show bands, and detailed output can be larger than the source image. The page provides side-by-side and overlay previews; it never embeds the original bitmap into an SVG.
