# 自动清理浏览记录

一个 Chrome 扩展，自动删除指定域名的浏览历史记录。

<p align="center">
  <img src="img/1.png" alt="收起隐藏页面" width="800"/>
</p>

<p align="center">
  <img src="img/2.png" alt="展开隐藏页面" width="800"/>
</p>

## 功能特性

- **自动历史清理**：访问配置的域名时，自动删除浏览历史记录  
- **通配符支持**：支持 `*.example.com` 等通配符模式匹配  
- **SPA 支持**：完整支持单页应用的路由切换（pushState/replaceState 和 hash 路由）  
- **域名隐藏**：支持隐藏指定域名，连续点击版本号解锁显示  
- **配置文件编辑**：解锁后可直接编辑配置文件  
- **本地存储**：配置信息仅保存在本地设备，保护隐私   

## 文件结构

```
History Auto Cleaner/
├── manifest.json          # 扩展配置文件
├── service_worker.js      # 后台服务工作脚本
├── options.html           # 选项页面 HTML
├── options.js             # 选项页面逻辑
├── popup.html             # 弹出窗口 HTML
├── popup.js               # 弹出窗口逻辑
└── README.md              # 说明文档
```

## 权限说明

| 权限 | 用途 |
|------|------|
| `history` | 删除浏览历史记录 |
| `storage` | 存储用户配置（仅本地存储） |
| `tabs` | 监听标签页变化 |
| `webNavigation` | 监听页面导航事件 |
| `host_permissions: *://*/*` | 访问所有网站以监听导航事件 |

## 数据格式

```json
{
    "isUnlocked": false,
    "privateDomains": {
      "example.com": true,
      "*.test.org": false,
      "subdomain.site.net": false,
      "*.private.*": false
    }
}
```

**说明**：
- **单一存储键**：使用 `privateDomains` 统一存储所有配置
- **对象映射**：域名作为键，布尔值作为值（`true`=显示，`false`=隐藏）
- **O(1) 查询**：使用对象结构提高查询效率
- **状态集成**：`isUnlocked` 控制隐藏域名的显示状态

## 安装方法

### 作为 Unpacked Extension 加载

1. 下载或克隆此项目到本地
2. 打开 Chrome 浏览器
3. 访问 `chrome://extensions/`
4. 开启右上角的"开发者模式"
5. 点击"加载已解压的扩展程序"
6. 选择项目文件夹

## 使用方法

### 配置域名

1. **通过选项页面**：
   - 右键点击扩展图标 → "选项"
   - 或访问 `chrome://extensions/` → 找到扩展 → "详情" → "扩展程序选项"

2. **通过弹出窗口**：
   - 点击扩展图标
   - 点击"管理域名"按钮

### 支持的域名格式

| 格式 | 说明 | 匹配示例 |
|------|------|----------|
| `example.com` | 精确匹配 | `example.com` |
| `*.example.com` | 通配符匹配 | `example.com`, `www.example.com`, `api.example.com` |
| `*.example.*` | 多级通配符 | `www.example.org`, `api.example.net` |
| `subdomain.example.org` | 特定子域名 | `subdomain.example.org` |

### 配置文件编辑

#### 解锁高级功能
1. 连续点击页面底部版本号三次
2. 页面会显示"高级功能已解锁"区域
3. 点击"配置文件"按钮

#### 编辑配置
1. 弹出窗口显示当前配置的 JSON 格式
2. 直接编辑 JSON 内容
3. 点击"保存"按钮应用更改

#### 域名隐藏功能

- **隐藏域名**：可以将指定域名标记为隐藏，默认不在列表中显示
- **解锁显示**：连续点击页面底部版本号三次，可解锁显示所有隐藏域名
- **状态持久**：解锁状态会保存，重启浏览器后保持

### Manifest V3 兼容
- 使用 Service Worker 替代 Background Pages
- 采用最新的权限和 API 规范

### 存储策略
- 使用 `chrome.storage.local` 本地存储
- 配置信息仅保存在当前设备
- 优化的对象结构，提高查询性能（O(1)）

### 错误处理
- 完善的异常捕获和日志记录
- 优雅的降级处理机制
- 配置文件编辑时的格式验证和错误提示

## 开发与调试

### 查看日志
1. 打开 `chrome://extensions/`
2. 找到扩展，点击"详情"
3. 点击"查看视图 service worker"
4. 在 Console 中查看日志

### 测试步骤
1. 配置测试域名（建议使用不重要的网站）
2. 访问该域名
3. 检查浏览器历史记录是否被删除
4. 查看 Console 日志确认工作状态