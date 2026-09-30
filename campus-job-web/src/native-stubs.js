// 构建期替代 Tauri API：网页版绝不调用原生 WebView/文件系统。
export function invoke(command) {
  return Promise.reject(new Error(`网页版不支持原生命令: ${command}`));
}

export function getVersion() {
  return Promise.resolve('web');
}
