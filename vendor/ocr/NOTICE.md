# Local OCR runtime attribution

- PaddleOCR.js 0.4.2 and PP-OCRv6_small detection / recognition models: PaddlePaddle Authors, Apache 2.0. Source: https://github.com/PaddlePaddle/PaddleOCR/tree/main/paddleocr-js . Official model URLs and SHA-256 checksums are pinned in `models.json`.
- ONNX Runtime Web 1.29.0: Microsoft Corporation, MIT. Source: https://github.com/microsoft/onnxruntime/tree/v1.29.0 . Its complete third-party notices are included here.
- OpenCV.js 4.10.0 (the `@techstark/opencv-js` package): Apache 2.0. Its package license is copied into the served licenses directory during asset preparation.
- Clipper 6.4.2 / JavaScript port 6.4.2.2: Angus Johnson (2010–2017) and Timo, Boost Software License 1.0. The port includes Tom Wu's JSBN code; its license is included separately.
- js-yaml: Vitaly Puzrin, MIT. Its package license is copied into the served licenses directory.

Our modification to the PaddleOCR JavaScript distribution adds only an export of its existing `OcrPipelineRunner` class as `PaddleOCRCore`. The published browser facade hardcodes DOM image decoding. The tool's Worker supplies a `cv.matFromImageData` adapter instead, retaining the official detection and recognition algorithms. `scripts/copy-ocr-assets.mjs` verifies the SDK version and source hash before adding that export and bundling. It also resolves ONNX Runtime to a same-origin module. No model weights are modified.

Generated files under `public/ocr/v1/` are rebuilt from pinned dependencies and verified model downloads. They are intentionally excluded from Git and PWA precaching. Increment the public runtime path when changing these immutable assets.
