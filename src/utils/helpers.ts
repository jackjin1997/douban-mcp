/**
 * 豆瓣电影MCP工具函数
 */

/**
 * 格式化电影信息，用于显示
 * @param movie 电影对象
 * @returns 格式化后的电影信息字符串
 */
export const formatMovieInfo = (movie: any): string => {
  if (!movie) return "无电影信息";

  const rating = movie.rating ? `${movie.rating.average}分` : "暂无评分";
  const genres =
    movie.genres && movie.genres.length > 0
      ? movie.genres.join("/")
      : "未知类型";

  return `《${movie.title}》(${rating}) - ${movie.year}年 - ${genres}`;
};

/**
 * 过滤敏感信息
 * @param data 原始数据
 * @returns 过滤后的数据
 */
export const filterSensitiveInfo = (data: any): any => {
  if (!data) return data;

  // 创建数据的深拷贝
  const filteredData = JSON.parse(JSON.stringify(data));

  // 如果是数组，递归处理每个元素
  if (Array.isArray(filteredData)) {
    return filteredData.map((item) => filterSensitiveInfo(item));
  }

  // 如果是对象，过滤敏感字段
  if (typeof filteredData === "object") {
    // 删除可能包含敏感信息的字段
    const sensitiveFields = ["api_key", "apikey", "password", "token"];

    sensitiveFields.forEach((field) => {
      if (filteredData[field]) {
        delete filteredData[field];
      }
    });

    // 递归处理对象的每个属性
    Object.keys(filteredData).forEach((key) => {
      if (typeof filteredData[key] === "object" && filteredData[key] !== null) {
        filteredData[key] = filterSensitiveInfo(filteredData[key]);
      }
    });
  }

  return filteredData;
};

/**
 * 解析范围字符串（如 "2010-2020"）
 * @param rangeStr 范围字符串
 * @returns 包含最小值和最大值的对象
 */
export const parseRange = (
  rangeStr: string
): { min: number; max: number } | null => {
  if (!rangeStr || !rangeStr.includes("-")) return null;

  const [minStr, maxStr] = rangeStr.split("-");
  const min = parseFloat(minStr);
  const max = parseFloat(maxStr);

  if (isNaN(min) || isNaN(max)) return null;

  return { min, max };
};

/**
 * 生成随机ID
 * @returns 随机ID字符串
 */
export const generateRandomId = (): string => {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
};

/**
 * 将电影列表转换为推荐格式
 * @param movies 电影列表
 * @returns 格式化的推荐列表
 */
export const formatRecommendations = (movies: any[]): string => {
  if (!movies || movies.length === 0) return "没有找到符合条件的电影推荐";

  let result = "以下是推荐的电影：\n";

  movies.forEach((movie, index) => {
    const rating = movie.rating ? `(${movie.rating.average}分)` : "";
    result += `${index + 1}. 《${movie.title}》${rating} - ${movie.year}年\n`;
  });

  return result;
};
