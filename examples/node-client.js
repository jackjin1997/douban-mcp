/**
 * 豆瓣电影MCP API Node.js客户端示例
 * 
 * 这个示例展示了如何在Node.js环境中使用MCP API
 */

const axios = require('axios');

// 基础URL配置，根据实际部署修改
const API_BASE_URL = 'http://localhost:3000/api';

/**
 * 搜索电影
 */
async function searchMovies(keyword, start = 0, count = 10) {
  try {
    const response = await axios.get(`${API_BASE_URL}/search`, {
      params: {
        q: keyword,
        start,
        count
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('搜索电影失败:', error.message);
    throw error;
  }
}

/**
 * 获取电影详情
 */
async function getMovieDetail(movieId) {
  try {
    const response = await axios.get(`${API_BASE_URL}/movie/${movieId}`);
    return response.data;
  } catch (error) {
    console.error('获取电影详情失败:', error.message);
    throw error;
  }
}

/**
 * 获取电影推荐
 */
async function getRecommendations(params = {}) {
  try {
    const response = await axios.post(`${API_BASE_URL}/recommend`, params);
    return response.data;
  } catch (error) {
    console.error('获取电影推荐失败:', error.message);
    throw error;
  }
}

/**
 * 主函数：运行示例
 */
async function runExamples() {
  try {
    // 示例1: 搜索电影
    console.log('示例1: 搜索电影 - 关键词: "星际"');
    const searchResult = await searchMovies('星际');
    console.log(JSON.stringify(searchResult, null, 2));
    console.log('\n-------------------------------------------\n');
    
    // 示例2: 获取电影详情
    console.log('示例2: 获取电影详情 - ID: "mock1"');
    const movieDetail = await getMovieDetail('mock1');
    console.log(JSON.stringify(movieDetail, null, 2));
    console.log('\n-------------------------------------------\n');
    
    // 示例3: 获取电影推荐
    console.log('示例3: 获取电影推荐 - 科幻类型，评分8-10');
    const recommendParams = {
      genres: ['科幻'],
      rating_range: '8-10',
      limit: 3
    };
    const recommendations = await getRecommendations(recommendParams);
    console.log(JSON.stringify(recommendations, null, 2));
    
  } catch (error) {
    console.error('示例运行失败:', error);
  }
}

// 运行示例
runExamples(); 