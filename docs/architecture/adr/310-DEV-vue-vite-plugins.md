# 310: Vue and Vite plugins

Use `vite-plugin-pwa` for the offline application lifecycle, subject to [ADR-316](316-pwa-update-lifecycle.md). Development tooling must remain development-only. The package manifests and Vite configuration define installed/enabled plugins; earlier Chart.js proposals are not evidence of a shipped dependency. CG visualization uses the existing implementation; evaluate new rendering libraries against P1 isolation and bundle impact before adoption.
