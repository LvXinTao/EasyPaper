# EasyPaper Tauri Desktop App Design

**Date:** 2026-04-01
**Status:** Draft - Pending Review
**Author:** Claude + User

## Overview

将 EasyPaper 从 CLI + 浏览器模式改造为原生桌面应用，用户双击应用图标即可直接使用，无需手动打开终端和浏览器。

## Problem Statement

当前 EasyPaper 的使用流程：
1. 用户在终端运行 `easypaper` 命令
2. 手动打开浏览器访问 `http://localhost:3000`
3. 使用完毕后手动关闭终端进程

这种方式对用户不够友好，尤其是非技术用户。

## Solution

采用 Tauri + Node.js Sidecar 方案，将应用打包为原生桌面应用：

- **Tauri** 提供 WebView 窗口和进程管理
- **Node.js Sidecar** 运行现有 Next.js server（保留所有功能）
- 用户双击应用 → 窗口直接打开 → 无需浏览器

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    EasyPaper.app                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  Tauri Main Process (Rust)             │  │
│  │  - 启动 Node.js sidecar                                │  │
│  │  - 管理 WebView 窗口                                    │  │
│  │  - 处理应用生命周期                                      │  │
│  └───────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Node.js Sidecar Process                   │  │
│  │  - Next.js server (localhost:动态端口)                  │  │
│  │  - 所有现有 API routes                                  │  │
│  │  - mupdf PDF 渲染                                       │  │
│  │  - SSE streaming                                        │  │
│  └───────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    WebView Window                       │  │
│  │  - 渲染 Next.js 前端                                    │  │
│  │  - 用户交互界面                                          │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

| 决策项 | 选择 | 原因 |
|--------|------|------|
| 桌面框架 | Tauri | 轻量（~10MB），性能好，用户无 Rust 经验也可接受 |
| Sidecar 模式 | Full Sidecar | 改动最小，保留所有现有功能 |
| PDF 渲染 | 保留 mupdf Node.js 依赖 | 避免重写，接受体积增加 |
| Server 端口 | 动态分配（3000-3100） | 防止端口冲突 |
| 数据存储 | 保持 `~/.easypaper/` | 与 CLI 版本兼容 |
| 窗口尺寸 | 1280×800，最小 900×600 | 适配双栏布局 |
| CLI 模式 | **保留并兼容** | 桌面应用与 CLI 共存，用户可选择任一方式 |
| Next.js 部署模式 | **Standalone output** | 更小的打包体积，更好的 sidecar 兼容性 |
| 错误对话框 | **Tauri dialog API** | 使用 `@tauri-apps/plugin-dialog` 实现原生对话框 |

## Project Structure

新增 Tauri 相关文件，不改变现有 `src/` 目录：

```
EasyPaper/
├── src-tauri/                    # 新增：Tauri Rust 代码
│   ├── src/
│   │   ├── main.rs               # Tauri 主进程入口
│   │   ├── sidecar.rs            # Node.js sidecar 管理
│   │   └── lib.rs                # 模块导出
│   ├── Cargo.toml                # Rust 依赖配置
│   ├── tauri.conf.json           # Tauri 配置
│   ├── icons/                    # 应用图标
│   └── build.rs                  # 编译脚本
│
├── sidecar-dist/                 # 新增：打包后的 sidecar（各平台）
│   ├── easypaper-server-macos-x64/
│   ├── easypaper-server-macos-arm64/
│   └── ...                       # 其他平台版本
│   └── mupdf.node                # Native module（外部部署）
│
├── src/                          # 现有：Next.js 代码（几乎不改）
│   └── ...
│
├── package.json                  # 修改：添加 Tauri scripts
├── bin/easypaper.js              # 保留：CLI 入口（兼容）
└── tauri-package-scripts/        # 新增：打包脚本
    ├── build-sidecar.js          # 构建 standalone Next.js
    └── copy-native-modules.js    # 复制 mupdf native modules
```

## Sidecar Communication Protocol

### Ready Signal Specification

Sidecar 通过 stdout 输出特定信号告知 Tauri 进程状态：

| 信号 | 格式 | 说明 |
|------|------|------|
| Ready | `EASYPAPER_READY:<port>\n` | Server 已启动，端口为 `<port>` |
| Error | `EASYPAPER_ERROR:<message>\n` | 启动失败，包含错误信息 |

**示例输出：**
```
EASYPAPER_READY:3000
```

**错误示例：**
```
EASYPAPER_ERROR:Port 3000-3100 all occupied
```

### Signal Detection in Tauri

```rust
// Tauri 监听 sidecar stdout，检测信号逻辑
fn detect_ready_signal(stdout: &str) -> Result<u16, String> {
    for line in stdout.lines() {
        if line.starts_with("EASYPAPER_READY:") {
            let port = line.strip_prefix("EASYPAPER_READY:")
                .unwrap()
                .parse::<u16>()
                .unwrap();
            return Ok(port);
        }
        if line.starts_with("EASYPAPER_ERROR:") {
            let error = line.strip_prefix("EASYPAPER_ERROR:")
                .unwrap();
            return Err(error.to_string());
        }
    }
    Err("No ready signal detected".to_string())
}
```

### Timeout Behavior

- 等待 Ready Signal 的超时时间：**10 秒**
- 超时后显示错误对话框，提供"重试"按钮

## Sidecar Process Management

### Port Allocation

- **端口发现由 Sidecar 负责**（而非 Tauri）
- Sidecar 内部逻辑：
  1. 获取 `PORT` 环境变量作为起始端口（默认 3000）
  2. 尝试绑定该端口
  3. 如果失败，尝试下一个端口（3001, 3002, ..., 3100）
  4. 成功后输出 `EASYPAPER_READY:<实际端口>`
- Tauri 只需监听 Ready Signal，获取实际使用的端口

### Startup Flow

1. Tauri 启动，分配候选端口（不在此阶段检测可用性）
2. 启动 sidecar，传入环境变量：
   - `PORT=<候选端口>`（sidecar 内部处理端口冲突）
   - `DATA_DIR=~/.easypaper/data`（当前已支持）
   - `CONFIG_DIR=~/.easypaper/config`（当前已支持）
3. 监听 sidecar stdout，等待 `EASYPAPER_READY:<port>` 信号
4. WebView 加载 `http://localhost:<port>`
5. 应用就绪

**注意：** 现有 `bin/easypaper.js` 已支持通过环境变量 `PORT`、`DATA_DIR`、`CONFIG_DIR` 配置，无需修改 `storage.ts`。

### Shutdown Flow

1. 用户关闭窗口
2. 发送 SIGTERM 给 sidecar
3. 等待最多 5 秒完成当前请求
4. 超时则 SIGKILL 强制退出
5. 应用退出

### CLI Entry Changes

修改 `bin/easypaper.js`，添加 sidecar 模式支持：

```javascript
// 添加 --ready-signal 选项
if (values['ready-signal']) {
  // Server 启动后输出 EASYPAPER_READY:<port> 到 stdout
  console.log(`EASYPAPER_READY:${port}`);
}

// 错误时输出 EASYPAPER_ERROR:<message>
```

**CLI 模式兼容性：**
- 不带 `--ready-signal` 时，行为与现在完全一致（普通 CLI 模式）
- 带 `--ready-signal` 时，输出就绪信号（桌面应用 sidecar 模式）
- 用户仍可通过 `npm install -g @lvxintao/easypaper` 使用 CLI 模式

### Concurrent CLI/Desktop Usage

- 桌面应用启动时检测 CLI 是否正在运行（通过端口检测）
- 如果 CLI 已占用端口，桌面应用显示提示："EasyPaper CLI 正在运行，请先关闭后再启动桌面应用"
- **不支持同时运行 CLI 和桌面应用**（数据目录和端口冲突）

## Window Configuration

```json
{
  "windows": [
    {
      "title": "EasyPaper",
      "width": 1280,
      "height": 800,
      "minWidth": 900,
      "minHeight": 600,
      "resizable": true,
      "center": true
    }
  ]
}
```

### Window State Persistence

使用 `tauri-plugin-window-state` 插件：
- 自动保存窗口位置、大小
- 下次启动时恢复上次状态
- **Phase 1 实现范围**

## Error Handling

### Error Dialog Implementation

使用 Tauri 官方 dialog 插件实现原生对话框：

```rust
use tauri_plugin_dialog::DialogExt;

// 显示错误对话框
app.dialog()
    .message("无法启动服务")
    .title("EasyPaper 错误")
    .kind(MessageDialogKind::Error)
    .buttons(Buttons::OkWithCancel("重试", "退出"))
    .show(|result| {
        if result == Buttons::Ok {
            // 重试启动
        } else {
            // 退出应用
        }
    });
```

### Sidecar Startup Failures

| 错误 | 处理 | 对话框类型 |
|------|------|------------|
| 端口全占用 | 对话框提示关闭其他服务 | Error + Ok |
| Sidecar 损坏/缺失 | 对话框提示重新安装 | Error + Ok |
| 启动超时（10秒） | 对话框 + 重试/退出按钮 | Error + OkCancel |
| 运行时崩溃 | 自动重启（最多 3 次） | 无对话框（自动处理） |
| CLI 正在运行 | 对话框提示关闭 CLI | Warning + Ok |

### Network Failures

- API 错误：保持现有前端 toast 提示
- Sidecar 重启期间：显示"服务恢复中"
- 完全无法连接：检测并重启 sidecar

### Single Instance

使用 Tauri `single-instance` 插件：
- 再次双击图标时激活现有窗口
- 不启动新进程

### macOS Specifics

- 支持 Apple Silicon + Intel（Universal Binary 或双版本）
- 最低支持 macOS 10.15（Catalina）
- 文件权限由 Tauri fs API 自动处理

## Logging Strategy

### Log Storage

日志存储在 OS 标准应用数据目录：

| 平台 | 日志路径 |
|------|----------|
| macOS | `~/Library/Logs/EasyPaper/` |
| Windows | `%APPDATA%/EasyPaper/logs/` |
| Linux | `~/.local/share/easypaper/logs/` |

### Log Content

- Sidecar stdout/stderr 输出
- Tauri 进程启动/关闭事件
- 错误和警告信息

### Log Access

用户可通过菜单"Help → Open Logs Folder"访问日志文件。

## Build & Distribution

### Next.js Standalone Build

修改 `next.config.ts`，启用 standalone 输出：

```typescript
// next.config.ts
const config = {
  output: 'standalone',
  // ... 其他配置
};
```

Standalone 模式优势：
- 自动包含必要依赖
- 更小的打包体积
- 无需完整 node_modules

### Native Module Handling (mupdf)

由于 `pkg` 与 native modules（如 `mupdf`）兼容性较差，采用**外部部署策略**：

1. **构建阶段：**
   - 运行 `next build` 生成 standalone 输出
   - 单独复制 `mupdf.node` 到 sidecar-dist 目录
   - **生成 `version.json`**：
     ```bash
     # tauri-package-scripts/build-sidecar.js
     echo '{"version":"${npm_package_version}","tauri_version":"${npm_package_version}"}' > sidecar-dist/version.json
     ```

2. **打包阶段：**
   - Sidecar 不使用 `pkg` 打包成单文件
   - 改用目录结构部署：
     ```
     sidecar-dist/
     ├── server.js          # Next.js standalone server
     ├── mupdf.node         # Native module
     └── node_modules/      # 最小依赖
     ```

3. **Tauri sidecar 配置：**

   Tauri 要求特定的二进制命名约定：
   ```
   sidecar-dist/
   ├── easypaper-server-x86_64-apple-darwin      # macOS Intel
   ├── easypaper-server-aarch64-apple-darwin     # macOS Apple Silicon
   ├── easypaper-server-x86_64-pc-windows-msvc   # Windows
   └── easypaper-server-x86_64-unknown-linux-gnu # Linux
   ```

   命名格式：`<binary-name>-<target-triple>`

   ```json
   // tauri.conf.json
   {
     "bundle": {
       "externalBin": [
         "sidecar-dist/easypaper-server"
       ]
     }
   }
   ```

   Tauri 会自动根据当前平台选择正确的二进制文件。

4. **运行时：**
   - Tauri 启动 sidecar 目录中的 `server.js`
   - Node.js 自动加载同目录的 `mupdf.node`

### Development Workflow

#### Development Commands

| 命令 | 说明 |
|------|------|
| `npm run dev` | Next.js 开发服务器（现有，保持不变） |
| `npm run tauri dev` | Tauri + Next.js 联合开发模式 |

#### `npm run tauri dev` 工作流

Tauri dev 模式会自动处理 Next.js：

```json
// tauri.conf.json
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:3000"
  }
}
```

流程：
1. `npm run tauri dev` 执行
2. Tauri 先运行 `npm run dev` 启动 Next.js dev server
3. Tauri Rust 编译并启动 WebView
4. WebView 连接 `http://localhost:3000`
5. 修改 `src/` → Next.js 热更新 → WebView 自动刷新
6. 修改 `src-tauri/` → Rust 热编译 → WebView 重新加载

#### Hot Reload Behavior

| 修改内容 | 行为 |
|----------|------|
| `src/`（前端代码） | Next.js HMR，WebView 局部刷新 |
| `src-tauri/`（Rust 代码） | Rust 重新编译，WebView 整体重载 |
| `bin/easypaper.js` | 需手动重启 dev server |

#### Debugging Sidecar

开发模式下 sidecar 运行在 dev server（非打包模式），可正常调试。
终端输出 sidecar stdout/stderr 用于调试。

### Distribution Artifacts

| 平台 | 产物 | 大小预估 |
|------|------|----------|
| macOS | `.app` + `.dmg` | 100-120MB |
| Windows | `.exe` + `.msi` | 100-120MB |
| Linux | `.deb` + `.AppImage` | 100-120MB |

**体积增加原因：**
- Node.js runtime（约 30MB）
- Next.js standalone + mupdf（约 20-30MB）
- WebView（macOS 使用系统 WebKit，Windows 使用 WebView2）

### Version Consistency

Sidecar 版本与 Tauri 版本绑定：

```rust
// 启动时验证版本
fn validate_sidecar_version() -> bool {
    // 读取 sidecar-dist/version.json
    // 与 Tauri 应用版本比对
    // 不匹配则显示警告
}
```

打包时自动生成 `version.json`：
```json
{
  "version": "1.0.1",
  "tauri_version": "1.0.1"
}
```

## Risks & Mitigations

| 风险 | 缓解措施 |
|------|----------|
| Sidecar 打包体积大 | 接受（用户已同意）；使用 standalone 模式优化 |
| mupdf native module 兼容性 | 外部部署策略，不打包进 pkg 单文件 |
| 用户无 Rust 经验 | Tauri 封装良好，只需少量 Rust 代码 |
| 多平台兼容性 | 先实现 macOS，验证后再扩展 Windows/Linux |
| 端口冲突 | 动态端口分配 + 错误提示 |
| CLI/Desktop 并发冲突 | 检测并提示用户关闭 CLI |

## Success Criteria

- 用户双击应用图标 → 3 秒内窗口打开
- 所有现有功能正常工作（PDF 上传、分析、聊天、笔记、书签）
- 数据与 CLI 版本兼容
- CLI 模式仍然可用（共存）
- macOS 上成功打包并分发

## Out of Scope (Phase 1)

- Windows / Linux 打包（先验证 macOS）
- 自动更新功能
- 系统托盘后台运行
- 多窗口支持
- 云同步