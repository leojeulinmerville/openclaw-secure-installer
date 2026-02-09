fn main() {
    // Explicitly declare build dependencies to prevent Cargo from scanning the entire
    // package directory. This avoids "access denied" errors on gen/schemas on Windows.
    println!("cargo::rerun-if-changed=tauri.conf.json");
    println!("cargo::rerun-if-changed=Cargo.toml");
    println!("cargo::rerun-if-changed=build.rs");
    println!("cargo::rerun-if-changed=capabilities");
    println!("cargo::rerun-if-changed=icons");

    tauri_build::build();
}
