# PageLite Archive Server

PageLite 的文件归档服务，使用 Go 标准库实现。文件通过上传接口保存到当前年份目录，首页提供目录浏览，ALL 页面汇总文件。

## 功能

- 使用 HTTP Basic 认证接收文件上传。
- 按当前年份保存文件，生成目录索引和 ALL 汇总列表。
- 通过环境变量配置多个隐藏目录，保留目录和文件的直接 URL 访问。
- 对目录名和文件名进行 URL 路径段编码，支持包含 `#`、`?`、`%` 等字符的名称链接。
- Docker 镜像默认使用上海时区 `Asia/Shanghai`。

上传需要认证，目录浏览和文件读取无需登录。服务提供 HTTP 接口。

## 从当前源码部署

需要安装 Docker 和 Docker Compose 插件。Dockerfile 使用 Go 1.25.3 构建，宿主机无需单独安装 Go。

以下命令在本项目根目录执行。

### 1. 修改部署配置

编辑 [docker-compose.yml](docker-compose.yml)。当前文件的用户名和密码均为 `admin`，部署前请替换为实际凭据。多目录配置示例：

```yaml
environment:
  - USER=admin
  - PASS=replace-with-your-password
  - MAX_UPLOAD_MB=50
  - HIDDEN_DIRS=tool,private
```

`replace-with-your-password` 是占位值，需要替换。隐藏名单只填写 `data` 下的根级目录名。

### 2. 构建镜像并启动

```shell
docker build -t sstarbucks/pagelite-server:latest .
docker compose up -d --pull=never
```

镜像标签与当前 Compose 的 `image` 配置一致，`--pull=never` 使用本地已构建镜像。

当前 Compose 只有 `image`，没有 `build` 配置，单独执行 `docker compose up` 不会构建本地 Dockerfile。若使用镜像仓库的发布版本，其功能以该镜像的实际内容为准。

启动后访问：

- 首页：<http://localhost:8080/>
- ALL 汇总页：<http://localhost:8080/all/>

### 3. 应用后续配置或源码修改

修改 Compose 中的环境变量后，重新创建容器：

```shell
docker compose up -d --pull=never --force-recreate
```

修改源码或 Dockerfile 后，先重新执行镜像构建命令，再重新创建容器。环境变量在程序启动时读取。

## 环境变量

| 变量 | 程序或镜像默认值 | 当前 Compose 配置 | 说明 |
| --- | --- | --- | --- |
| `USER` | 无，必填 | `admin` | 上传认证用户名。 |
| `PASS` | 无，必填 | `admin` | 上传认证密码。任一凭据为空时，程序退出。 |
| `PORT` | `8080` | 未设置 | 服务监听端口；修改时需同步调整 Compose 的容器端口映射。 |
| `MAX_UPLOAD_MB` | `50` | `50` | 单个上传文件上限，应设为正整数，每单位为 1MiB。无效值记录日志并回退至 50MiB。 |
| `HIDDEN_DIRS` | 空，不隐藏目录 | `tool` | 逗号分隔的根级目录名，例如 `tool,private`。 |
| `TZ` | 镜像默认 `Asia/Shanghai` | 未设置 | 容器时区，可在运行时覆盖。 |

镜像内已包含时区数据。归档年份、页面生成时间、文件修改时间显示和日志默认使用上海时间（UTC+08:00）。

## 数据存储

存储位置为进程工作目录下的 `./data`。当前镜像的工作目录是 `/app`，Compose 将容器的 `/app/data` 映射到宿主机的 `./data`。

上传自动创建当前年份目录。例如：

```text
data/
├── 2026/
│   └── example.html
├── tool/
│   └── helper.js
└── private/
    └── notes.html
```

`tool`、`private` 表示已放置在存储根目录中的其他目录。上传接口仍统一按年份保存，隐藏名单不会改变上传位置。

同一年内上传同名文件会直接覆盖旧文件。需要保留多个版本时，请使用不同文件名。

## 隐藏目录

配置示例：

```yaml
- HIDDEN_DIRS=tool,private
```

- 首页不展示 `tool/`、`private/` 的目录入口。
- `/all/` 和 `/ALL/` 不扫描这些目录，其文件不计入汇总列表和数量。
- `/tool/`、`/private/` 及目录下文件的直接 URL 仍可访问。
- 名称精确匹配；去除两端空白，忽略空项和重复项。未设置或值为空时不隐藏目录。
- 仅匹配存储根目录下的目录，不匹配同名普通文件或其他目录内的同名子目录。

隐藏是列表展示规则，知道 URL 的访问者仍能访问对应内容。详细规则见[首页目录展示规则](docs/index-visibility.md)。

## 页面与接口

| 地址 | 使用方式 | 认证 | 说明 |
| --- | --- | --- | --- |
| `/` | `GET` | 无 | 存储根目录索引。 |
| `/all/`、`/ALL/` | `GET` | 无 | 汇总根级目录中的直接文件，按修改时间倒序排列，不递归扫描子目录。 |
| `/2026/` 等目录地址 | `GET` | 无 | 目录索引，目录地址需以 `/` 结尾。 |
| `/2026/example.html` 等文件地址 | `GET` | 无 | 返回对应文件内容。 |
| `/upload` | `POST` | HTTP Basic | 接收 `multipart/form-data`，文件字段名为 `file`。 |

### 上传示例

先准备 `example.html`，将凭据替换为部署时设置的 `USER` 和 `PASS`：

```shell
curl --user "admin:replace-with-your-password" --form "file=@./example.html" "http://localhost:8080/upload"
```

Windows PowerShell 中使用 `curl.exe` 替代 `curl`，避免调用同名别名。`--form` 自动使用 POST 和 multipart 表单。

成功响应示例（HTTP `200`）：

```json
{
  "success": true,
  "filename": "example.html",
  "message": "上传成功"
}
```

若上传年份为 2026，文件保存在 `data/2026/example.html`，访问地址为 `http://localhost:8080/2026/example.html`。

### 上传大小与错误响应

`MAX_UPLOAD_MB=50` 表示文件内容最多 50MiB（52,428,800 字节）。完整请求另预留固定 1MiB，总上限为 51MiB，表单附加内容也受该总上限约束。

| 状态码 | 含义 |
| --- | --- |
| `200` | 文件上传成功。 |
| `400` | 表单解析失败或缺少 `file` 文件字段。 |
| `401` | 认证缺失、格式无效或用户名、密码不匹配。 |
| `404` | 目录或文件不存在，或目录请求超出允许范围。 |
| `405` | 已通过认证的上传请求使用了 POST 以外的方法。 |
| `413` | 文件或完整请求超过大小上限。 |
| `500` | 创建目录、保存文件或生成目录索引失败。 |

上传成功和上传处理错误返回 JSON；认证错误、方法错误和目录访问错误使用普通错误响应。

本文依据当前源码和配置编写，部署命令与上传示例已对照官方文档进行静态核对，未在本次文档编写中构建镜像、启动服务或实际执行上传。
