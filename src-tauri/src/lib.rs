use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::{Command, Stdio};
use std::thread;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Serialize, Deserialize)]
pub struct ScriptFile {
    pub name: String,
    pub path: String,
    pub script_type: String,
    pub readme_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ParamDef {
    pub name: String,
    pub required: bool,
    pub default_value: Option<String>,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScriptMeta {
    pub description: String,
    pub params: Vec<ParamDef>,
}

// Parses a single @param line: NAME required|default:VALUE "description"
fn parse_param_line(s: &str) -> Option<ParamDef> {
    let mut parts = s.splitn(3, ' ');
    let name = parts.next()?.trim().to_string();
    if name.is_empty() {
        return None;
    }
    let mode = parts.next().unwrap_or("optional").trim();
    let desc_raw = parts.next().unwrap_or("").trim();
    let description = desc_raw.trim_matches('"').to_string();

    let (required, default_value) = if mode == "required" {
        (true, None)
    } else if let Some(val) = mode.strip_prefix("default:") {
        (false, Some(val.trim_matches('"').to_string()))
    } else {
        // "optional" or anything else — no default
        (false, None)
    };

    Some(ParamDef { name, required, default_value, description })
}

// Reads the first 60 comment lines of a script and extracts @description / @param directives.
// Works for both shell (#) and Python (#) comment styles.
#[tauri::command]
fn parse_script_meta(path: String) -> Result<ScriptMeta, String> {
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut description = String::new();
    let mut params = Vec::new();

    for line in content.lines().take(60) {
        let stripped = match line.trim().strip_prefix('#') {
            Some(s) => s.trim(),
            None => continue,
        };
        if let Some(rest) = stripped.strip_prefix("@description") {
            description = rest.trim().to_string();
        } else if let Some(rest) = stripped.strip_prefix("@param") {
            if let Some(p) = parse_param_line(rest.trim()) {
                params.push(p);
            }
        }
    }

    Ok(ScriptMeta { description, params })
}

// Runs a script, injecting params as environment variables, streaming output as Tauri events.
#[tauri::command]
fn run_script(
    app: AppHandle,
    script_path: String,
    script_type: String,
    params: HashMap<String, String>,
) -> Result<(), String> {
    let program = match script_type.as_str() {
        "shell" => "bash",
        "python" => "python3",
        _ => return Err(format!("unknown script type: {}", script_type)),
    };

    let mut child = Command::new(program)
        .arg(&script_path)
        .envs(&params)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to start '{}': {}", program, e))?;

    let stdout = child.stdout.take().expect("stdout pipe");
    let stderr = child.stderr.take().expect("stderr pipe");

    let app1 = app.clone();
    thread::spawn(move || {
        for line in BufReader::new(stdout).lines().flatten() {
            let _ = app1.emit("script-output", serde_json::json!({ "type": "stdout", "text": line }));
        }
    });

    let app2 = app.clone();
    thread::spawn(move || {
        for line in BufReader::new(stderr).lines().flatten() {
            let _ = app2.emit("script-output", serde_json::json!({ "type": "stderr", "text": line }));
        }
    });

    thread::spawn(move || {
        let (code, success) = child
            .wait()
            .map(|s| (s.code().unwrap_or(-1), s.success()))
            .unwrap_or((-1, false));
        let _ = app.emit("script-finished", serde_json::json!({ "exit_code": code, "success": success }));
    });

    Ok(())
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

// Scans a directory for .sh / .py files and checks for a README.md.
#[tauri::command]
fn scan_folder(folder_path: String) -> Result<Vec<ScriptFile>, String> {
    let dir = std::fs::read_dir(&folder_path).map_err(|e| e.to_string())?;

    let readme_path = {
        let p = Path::new(&folder_path).join("README.md");
        if p.exists() { Some(p.to_string_lossy().to_string()) } else { None }
    };

    let mut scripts = Vec::new();
    for entry in dir.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let script_type = match path.extension().and_then(|e| e.to_str()) {
            Some("sh") => "shell",
            Some("py") => "python",
            _ => continue,
        };
        let name = path
            .file_stem()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();
        scripts.push(ScriptFile {
            name,
            path: path.to_string_lossy().to_string(),
            script_type: script_type.to_string(),
            readme_path: readme_path.clone(),
        });
    }

    Ok(scripts)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    // ── scan_folder ──────────────────────────────────────────────────────────

    fn tmp_with_scripts() -> TempDir {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("deploy.sh"), "#!/bin/bash\necho deployed").unwrap();
        fs::write(dir.path().join("process.py"), "print('processing')").unwrap();
        fs::write(dir.path().join("README.md"), "# Test Scripts\nSome docs.").unwrap();
        fs::write(dir.path().join("notes.txt"), "ignored").unwrap();
        dir
    }

    #[test]
    fn scan_finds_sh_and_py_only() {
        let dir = tmp_with_scripts();
        let scripts = scan_folder(dir.path().to_str().unwrap().to_string()).unwrap();
        assert_eq!(scripts.len(), 2);
        let types: Vec<&str> = scripts.iter().map(|s| s.script_type.as_str()).collect();
        assert!(types.contains(&"shell"));
        assert!(types.contains(&"python"));
    }

    #[test]
    fn scan_attaches_readme_path() {
        let dir = tmp_with_scripts();
        let scripts = scan_folder(dir.path().to_str().unwrap().to_string()).unwrap();
        assert!(scripts.iter().all(|s| s.readme_path.is_some()));
    }

    #[test]
    fn scan_no_readme_gives_none() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("run.sh"), "echo hi").unwrap();
        let scripts = scan_folder(dir.path().to_str().unwrap().to_string()).unwrap();
        assert_eq!(scripts.len(), 1);
        assert!(scripts[0].readme_path.is_none());
    }

    #[test]
    fn scan_empty_folder_returns_empty() {
        let dir = TempDir::new().unwrap();
        assert!(scan_folder(dir.path().to_str().unwrap().to_string()).unwrap().is_empty());
    }

    #[test]
    fn scan_nonexistent_folder_is_err() {
        assert!(scan_folder("/nonexistent/path/xyz".to_string()).is_err());
    }

    #[test]
    fn script_names_use_file_stem() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("my-deploy.sh"), "echo hi").unwrap();
        let scripts = scan_folder(dir.path().to_str().unwrap().to_string()).unwrap();
        assert_eq!(scripts[0].name, "my-deploy");
    }

    // ── read_file ────────────────────────────────────────────────────────────

    #[test]
    fn read_file_returns_content() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("hello.txt");
        fs::write(&path, "hello world").unwrap();
        assert_eq!(read_file(path.to_str().unwrap().to_string()).unwrap(), "hello world");
    }

    #[test]
    fn read_file_missing_is_err() {
        assert!(read_file("/no/such/file.txt".to_string()).is_err());
    }

    // ── parse_param_line ─────────────────────────────────────────────────────

    #[test]
    fn param_required() {
        let p = parse_param_line("ENV required \"Target environment\"").unwrap();
        assert_eq!(p.name, "ENV");
        assert!(p.required);
        assert_eq!(p.default_value, None);
        assert_eq!(p.description, "Target environment");
    }

    #[test]
    fn param_with_default() {
        let p = parse_param_line("VERSION default:latest \"Version tag\"").unwrap();
        assert_eq!(p.name, "VERSION");
        assert!(!p.required);
        assert_eq!(p.default_value, Some("latest".to_string()));
        assert_eq!(p.description, "Version tag");
    }

    #[test]
    fn param_optional_no_default() {
        let p = parse_param_line("DEBUG optional \"Enable debug output\"").unwrap();
        assert!(!p.required);
        assert_eq!(p.default_value, None);
    }

    #[test]
    fn param_no_description() {
        let p = parse_param_line("ENV required").unwrap();
        assert_eq!(p.name, "ENV");
        assert!(p.required);
        assert_eq!(p.description, "");
    }

    #[test]
    fn param_empty_string_is_none() {
        assert!(parse_param_line("").is_none());
        assert!(parse_param_line("   ").is_none());
    }

    // ── parse_script_meta ────────────────────────────────────────────────────

    #[test]
    fn meta_extracts_description() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("s.sh");
        fs::write(&path, "#!/bin/bash\n# @description Deploy the app\necho hi").unwrap();
        let meta = parse_script_meta(path.to_str().unwrap().to_string()).unwrap();
        assert_eq!(meta.description, "Deploy the app");
        assert!(meta.params.is_empty());
    }

    #[test]
    fn meta_extracts_params() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("s.sh");
        fs::write(&path, concat!(
            "#!/bin/bash\n",
            "# @description Test script\n",
            "# @param ENV required \"Target env\"\n",
            "# @param VERSION default:latest \"Version\"\n",
            "echo hi\n"
        )).unwrap();
        let meta = parse_script_meta(path.to_str().unwrap().to_string()).unwrap();
        assert_eq!(meta.params.len(), 2);
        assert_eq!(meta.params[0].name, "ENV");
        assert!(meta.params[0].required);
        assert_eq!(meta.params[1].default_value, Some("latest".to_string()));
    }

    #[test]
    fn meta_works_for_python_files() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("s.py");
        fs::write(&path, "# @description Process data\n# @param INPUT required \"Input path\"\nprint('hi')").unwrap();
        let meta = parse_script_meta(path.to_str().unwrap().to_string()).unwrap();
        assert_eq!(meta.description, "Process data");
        assert_eq!(meta.params[0].name, "INPUT");
    }

    #[test]
    fn meta_empty_when_no_annotations() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("s.sh");
        fs::write(&path, "#!/bin/bash\necho hi").unwrap();
        let meta = parse_script_meta(path.to_str().unwrap().to_string()).unwrap();
        assert_eq!(meta.description, "");
        assert!(meta.params.is_empty());
    }

    #[test]
    fn meta_missing_file_is_err() {
        assert!(parse_script_meta("/no/such/file.sh".to_string()).is_err());
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![run_script, read_file, write_file, scan_folder, parse_script_meta])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
