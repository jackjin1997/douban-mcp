import {
  formatMovieInfo,
  filterSensitiveInfo,
  parseRange,
  generateRandomId,
  formatRecommendations,
} from "../../utils/helpers";
import { Movie } from "../../types";

describe("Helpers Utils", () => {
  // formatMovieInfo 测试
  describe("formatMovieInfo", () => {
    it("应正确格式化电影信息", () => {
      const movie = {
        title: "测试电影",
        year: "2023",
        genres: ["动作", "科幻"],
        rating: {
          average: 8.5,
        },
      };

      const result = formatMovieInfo(movie);
      expect(result).toBe("《测试电影》(8.5分) - 2023年 - 动作/科幻");
    });

    it("当电影对象为null时应返回默认信息", () => {
      const result = formatMovieInfo(null);
      expect(result).toBe("无电影信息");
    });

    it("当缺少评分时应显示暂无评分", () => {
      const movie = {
        title: "测试电影",
        year: "2023",
        genres: ["动作", "科幻"],
      };

      const result = formatMovieInfo(movie);
      expect(result).toBe("《测试电影》(暂无评分) - 2023年 - 动作/科幻");
    });

    it("当缺少类型时应显示未知类型", () => {
      const movie = {
        title: "测试电影",
        year: "2023",
        rating: {
          average: 8.5,
        },
      };

      const result = formatMovieInfo(movie);
      expect(result).toBe("《测试电影》(8.5分) - 2023年 - 未知类型");
    });
  });

  // filterSensitiveInfo 测试
  describe("filterSensitiveInfo", () => {
    it("应过滤敏感信息", () => {
      const data = {
        name: "测试数据",
        apikey: "sensitive_key",
        password: "secret",
        user: {
          name: "user1",
          token: "user_token",
        },
      };

      const filtered = filterSensitiveInfo(data);
      expect(filtered).toEqual({
        name: "测试数据",
        user: {
          name: "user1",
        },
      });
      expect(filtered.apikey).toBeUndefined();
      expect(filtered.password).toBeUndefined();
      expect(filtered.user.token).toBeUndefined();
    });

    it("应处理数组数据", () => {
      const dataArray = [
        { name: "item1", apikey: "key1" },
        { name: "item2", password: "pass2" },
      ];

      const filtered = filterSensitiveInfo(dataArray);
      expect(filtered).toEqual([{ name: "item1" }, { name: "item2" }]);
    });

    it("当数据为null时应返回null", () => {
      const result = filterSensitiveInfo(null);
      expect(result).toBeNull();
    });
  });

  // parseRange 测试
  describe("parseRange", () => {
    it("应正确解析范围字符串", () => {
      const result = parseRange("2010-2020");
      expect(result).toEqual({ min: 2010, max: 2020 });
    });

    it("应处理浮点数范围", () => {
      const result = parseRange("7.5-9.8");
      expect(result).toEqual({ min: 7.5, max: 9.8 });
    });

    it("当输入不是有效范围格式时应返回null", () => {
      expect(parseRange("invalid")).toBeNull();
      expect(parseRange("")).toBeNull();
      expect(parseRange("10-abc")).toBeNull();
    });
  });

  // generateRandomId 测试
  describe("generateRandomId", () => {
    it("应生成一个字符串ID", () => {
      const id = generateRandomId();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    it("连续调用应生成不同的ID", () => {
      const id1 = generateRandomId();
      const id2 = generateRandomId();
      expect(id1).not.toEqual(id2);
    });
  });

  // formatRecommendations 测试
  describe("formatRecommendations", () => {
    it("应正确格式化电影推荐列表", () => {
      const movies = [
        { title: "电影1", year: "2020", rating: { average: 8.5 } },
        { title: "电影2", year: "2021", rating: { average: 9 } },
      ];

      const result = formatRecommendations(movies);
      expect(result).toContain("以下是推荐的电影：");
      expect(result).toContain("1. 《电影1》(8.5分) - 2020年");
      expect(result).toContain("2. 《电影2》(9分) - 2021年");
    });

    it("当电影列表为空时应返回无结果信息", () => {
      const result = formatRecommendations([]);
      expect(result).toBe("没有找到符合条件的电影推荐");
    });

    it("当电影没有评分时应正确处理", () => {
      const movies = [{ title: "电影1", year: "2020" }];

      const result = formatRecommendations(movies);
      expect(result).toContain("1. 《电影1》 - 2020年");
    });
  });
});
