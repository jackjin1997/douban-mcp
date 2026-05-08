# 获取豆瓣 Cookie

## 步骤

1. 在 Chrome / Firefox / Safari 中登录 https://www.douban.com
2. 打开开发者工具（F12 / ⌥⌘I），切到 **Network** 面板
3. 刷新页面，点任意一条到 `douban.com` 的请求
4. 在 **Headers → Request Headers** 找到 `Cookie:` 行
5. 复制整行 `Cookie:` 后面的值（注意是值，不带 `Cookie:` 前缀）

## 关键字段说明

douban-mcp 主要依赖三个字段：

| 字段 | 用途 |
|---|---|
| `bid` | 浏览器指纹（任何请求都会带） |
| `dbcl2` | 登录态 token，**没它就不算登录** |
| `ck` | CSRF token，**写操作必需** |

## 配置

```bash
export DOUBAN_COOKIE='bid=ABC; dbcl2="123456:xyz=="; ck=ABCD; ll="108288"'
```

## 多久过期

豆瓣 cookie 通常 30 天有效，但活跃使用会延期。被风控触发后可能立即失效——重新登录浏览器再复制即可。

## 安全提示

- **永远不要把 cookie commit 到 git**
- 使用 `.env` 文件保存（已在 `.gitignore` 里）
- 不要把含 cookie 的截图发到公开渠道
- 怀疑泄露时立即在豆瓣"账号设置"中"修改密码"以使所有 session 失效
