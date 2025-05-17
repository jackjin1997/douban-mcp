# 豆瓣电影 MCP (Model Control Panel)

这是一个为大型语言模型设计的豆瓣电影推荐MCP服务，可以帮助大模型获取电影数据、搜索电影以及获取电影推荐。

## 功能特性

- 获取电影详情：根据电影ID获取详细信息
- 搜索电影：根据关键词搜索电影
- 电影推荐：根据用户偏好（类型、标签、年代等）获取电影推荐

## 技术栈

- TypeScript
- Node.js
- Express
- pnpm

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 配置环境变量

创建 `.env` 文件并设置相关环境变量：

```
PORT=3000
DOUBAN_API_BASE_URL=https://api.douban.com/v2
DOUBAN_API_KEY=your_douban_api_key
```

> 注意：本项目目前使用模拟数据，不需要真实的豆瓣API密钥即可运行。

### 开发模式运行

```bash
pnpm dev
```

### 构建项目

```bash
pnpm build
```

### 生产环境运行

```bash
pnpm start
```

## API 接口说明

### 获取电影详情

```
GET /api/movie/:id
```

#### 参数：

- `id`: 电影ID

#### 返回示例：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "1234",
    "title": "模拟电影 1234",
    "original_title": "Mock Movie 1234",
    "year": "2023",
    "genres": ["剧情", "科幻"],
    "rating": {
      "max": 10,
      "average": 8.5,
      "stars": "45",
      "min": 0
    },
    "summary": "这是一个模拟的电影简介...",
    // 其他字段...
  }
}
```

### 搜索电影

```
GET /api/search?q=关键词&start=0&count=20
```

#### 参数：

- `q`: 搜索关键词（必填）
- `start`: 分页起始位置（可选，默认0）
- `count`: 每页数量（可选，默认20）

#### 返回示例：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "count": 10,
    "start": 0,
    "total": 50,
    "subjects": [
      // 电影列表...
    ]
  }
}
```

### 电影推荐

```
POST /api/recommend
```

#### 请求体：

```json
{
  "genres": ["剧情", "科幻"],
  "tags": ["悬疑", "太空"],
  "year_range": "2010-2023",
  "rating_range": "7-10",
  "limit": 5
}
```

#### 参数说明：

- `genres`: 电影类型数组（可选）
- `tags`: 标签数组（可选）
- `year_range`: 年份范围（可选，格式："开始年份-结束年份"）
- `rating_range`: 评分范围（可选，格式："最低分-最高分"）
- `limit`: 返回数量限制（可选，默认10）

#### 返回示例：

```json
{
  "code": 200,
  "message": "success",
  "data": [
    // 推荐电影列表...
  ]
}
```

## 大模型调用示例

以下是一个大模型如何调用此MCP的示例：

```
用户: "请推荐几部高分科幻电影"

大模型: 
[调用 MCP API]
POST /api/recommend
Body: {"genres": ["科幻"], "rating_range": "8-10", "limit": 5}

[获取结果后]
"以下是几部高分科幻电影推荐："
1. 《模拟电影 0》(8.7分) - 2018年
2. 《模拟电影 1》(9.2分) - 2020年
3. 《模拟电影 2》(8.5分) - 2021年
4. 《模拟电影 3》(8.9分) - 2019年
5. 《模拟电影 4》(9.0分) - 2022年
```

## 注意事项

- 本项目目前使用模拟数据，不依赖真实的豆瓣API
- 如需接入真实豆瓣API，需要申请相关API密钥并修改相关服务实现

## 贡献

欢迎提交问题和改进建议！

## 许可

ISC 