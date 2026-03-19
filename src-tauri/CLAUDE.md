# src-tauri/ -- Tauri Backend

- Plugins registered in src/lib.rs via .plugin() calls
- All Tauri commands return Result<T, String> for error handling
- Capabilities defined in capabilities/default.json
- Principle of least privilege -- no unnecessary permissions
