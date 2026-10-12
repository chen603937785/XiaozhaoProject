# Third-party source

These four JavaScript modules originate from the local
resume-form-assistant-plugin-main source provided by the user (网申快填).
Copyright (c) 2026 TshyGO. Licensed under MIT; see LICENSE in this directory.

Files: ai-helpers.js, custom-controls.js, control-adapters.js, field-scan.js.
Xiaomai changes to custom-controls.js (2026-10-10): wait for initial dictionary
loading, browse virtual lists before search, and expand AntD TreeSelect groups.
Further Xiaomai changes (0.1.6): unique cascader leaf traversal, incomplete-path
rejection, legacy/leaf display recognition; control-adapters.js validates bounded
leaf alternatives, and field-scan.js recognizes legacy AntD Cascader wrappers.
Xiaomai's account integration, resume mappings, UI and engine bridge live outside
this directory. No upstream account service or native messaging is included.
