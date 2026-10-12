use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{path::Path, time::Duration};

const ORIGIN: &str = "https://my88ai.com";
const MAX_SCRIPT: usize = 1024 * 1024;
pub const BUNDLED: &str = include_str!("../autofill.js");
#[derive(Clone, Deserialize, Serialize)]
struct Release { protocol: u32, version: String, sha256: String, path: String, #[serde(default)] disabled: bool }
#[derive(Deserialize, Serialize)]
struct Cached { release: Release, script: String }
fn valid(r: &Release, script: &str) -> bool {
    r.protocol == 1 && !r.disabled && script.len() <= MAX_SCRIPT && !script.is_empty()
        && format!("{:x}", Sha256::digest(script.as_bytes())) == r.sha256
}
async fn limited(client: &reqwest::Client, url: &str, limit: usize) -> Result<Vec<u8>, String> {
    let mut response = client.get(url).send().await.map_err(|e|e.to_string())?
        .error_for_status().map_err(|e|e.to_string())?;
    if response.content_length().unwrap_or(0) > limit as u64 { return Err("更新文件过大".into()); }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|e|e.to_string())? {
        if bytes.len()+chunk.len()>limit { return Err("更新文件过大".into()); }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}
/// No resume, account token or web-page contents are sent to this public update endpoint.
pub async fn load(dir: &Path) -> String {
    let cache_path = dir.join("autofill-v1.json");
    let cached = std::fs::read(&cache_path).ok().filter(|b|b.len()<2*MAX_SCRIPT)
        .and_then(|b|serde_json::from_slice::<Cached>(&b).ok()).filter(|c|valid(&c.release,&c.script));
    let fallback = cached.as_ref().map(|c|c.script.clone()).unwrap_or_else(||BUNDLED.into());
    let Ok(client) = reqwest::Client::builder().timeout(Duration::from_secs(4))
        .redirect(reqwest::redirect::Policy::none()).build() else { return fallback; };
    let Ok(bytes) = limited(&client,&format!("{ORIGIN}/autofill/manifest.json"),8192).await else { return fallback; };
    let Ok(release) = serde_json::from_slice::<Release>(&bytes) else { return fallback; };
    if release.disabled {
        let _ = std::fs::remove_file(&cache_path);
        return BUNDLED.into();
    }
    if release.protocol!=1 || !release.path.starts_with("/autofill/releases/") || release.path.contains("..")
        || !release.path.bytes().all(|b|b.is_ascii_alphanumeric() || b"/._-".contains(&b)) { return fallback; }
    if let Some(c) = cached { if c.release.sha256==release.sha256 { return c.script; } }
    let Ok(bytes) = limited(&client,&format!("{ORIGIN}{}",release.path),MAX_SCRIPT).await else { return fallback; };
    let Ok(script) = String::from_utf8(bytes) else { return fallback; };
    if !valid(&release,&script) { return fallback; }
    // Cache both manifest and script in a single file so interrupted writes fail closed.
    if let Ok(bytes)=serde_json::to_vec(&Cached{release,script:script.clone()}) {
        let _ = std::fs::create_dir_all(dir);
        let _ = std::fs::write(cache_path,bytes);
    }
    script
}
#[cfg(test)] mod tests {
    use super::*;
    #[test] fn rejects_corruption_and_incompatible_protocol() {
        let mut r=Release{protocol:1,version:"1.0.0".into(),sha256:format!("{:x}",Sha256::digest(b"hello")),path:"/autofill/releases/a.js".into(),disabled:false};
        assert!(valid(&r,"hello"));assert!(!valid(&r,"changed"));r.protocol=2;assert!(!valid(&r,"hello"));
    }
}
