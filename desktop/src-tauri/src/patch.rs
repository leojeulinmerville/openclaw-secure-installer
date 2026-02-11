use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug)]
pub struct PatchResult {
    pub applied: bool,
    pub error: Option<String>,
    pub modified_files: Vec<String>,
}

/// Applies a Unified Diff patch to the workspace.
/// Strictly enforces that all file paths are within the workspace_path.
pub fn apply_patch_safely(workspace_path: &str, patch_content: &str) -> PatchResult {
    let root = Path::new(workspace_path);
    if !root.exists() {
        return PatchResult {
            applied: false,
            error: Some("Workspace path does not exist".to_string()),
            modified_files: vec![],
        };
    }

    // 1. Write the patch to a temporary file INSIDE the workspace to avoid cross-drive issues
    let patch_file_path = root.join(".temp_apply.patch");
    if let Err(e) = fs::write(&patch_file_path, patch_content) {
        return PatchResult {
            applied: false,
            error: Some(format!("Failed to write temp patch file: {}", e)),
            modified_files: vec![],
        };
    }

    // 2. Try applying with git apply
    let mut cmd = Command::new("git");
    cmd.arg("apply");
    cmd.arg("--ignore-space-change");
    cmd.arg("--ignore-whitespace");
    cmd.arg(".temp_apply.patch"); // Relative path since we cd into workspace
    cmd.current_dir(root);

    // Ensure no window on Windows
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    match cmd.output() {
        Ok(output) => {
            // cleanup
            let _ = fs::remove_file(&patch_file_path);

            if output.status.success() {
                // Success!
                // Ideally we parse the patch content to list modified files, 
                // but for now we just return empty list or parse it manually if needed.
                let modified = parse_modified_files_from_diff(patch_content);
                PatchResult {
                    applied: true,
                    error: None,
                    modified_files: modified,
                }
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                PatchResult {
                    applied: false,
                    error: Some(format!("git apply failed: {}", stderr)),
                    modified_files: vec![],
                }
            }
        }
        Err(e) => {
            let _ = fs::remove_file(&patch_file_path);
            PatchResult {
                applied: false,
                error: Some(format!("Failed to execute git: {}. Is git installed?", e)),
                modified_files: vec![],
            }
        }
    }
}

fn parse_modified_files_from_diff(diff: &str) -> Vec<String> {
    let mut files = Vec::new();
    for line in diff.lines() {
        if line.starts_with("+++ b/") {
            files.push(line.replace("+++ b/", ""));
        } else if line.starts_with("+++ ") && !line.contains("/dev/null") {
             files.push(line.replace("+++ ", "").trim().to_string());
        }
    }
    files
}

/// Helper to validate path is inside workspace
pub fn is_safe_path(root: &Path, target: &Path) -> bool {
    // Canonicalize both
    if let (Ok(root_canon), Ok(target_canon)) = (root.canonicalize(), target.canonicalize()) {
        target_canon.starts_with(root_canon)
    } else {
        // If target doesn't exist (new file), check parent
        if let Some(parent) = target.parent() {
             if let (Ok(root_canon), Ok(parent_canon)) = (root.canonicalize(), parent.canonicalize()) {
                 return parent_canon.starts_with(root_canon);
             }
        }
        false
    }
}
