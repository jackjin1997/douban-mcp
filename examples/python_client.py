#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
豆瓣电影MCP API Python客户端示例

这个示例展示了如何在Python环境中使用MCP API
"""

import json
import requests

# 基础URL配置，根据实际部署修改
API_BASE_URL = "http://localhost:3000/api"


def search_movies(keyword, start=0, count=10):
    """搜索电影"""
    try:
        response = requests.get(
            f"{API_BASE_URL}/search",
            params={"q": keyword, "start": start, "count": count},
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"搜索电影失败: {e}")
        raise


def get_movie_detail(movie_id):
    """获取电影详情"""
    try:
        response = requests.get(f"{API_BASE_URL}/movie/{movie_id}")
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"获取电影详情失败: {e}")
        raise


def get_recommendations(params=None):
    """获取电影推荐"""
    if params is None:
        params = {}

    try:
        response = requests.post(f"{API_BASE_URL}/recommend", json=params)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"获取电影推荐失败: {e}")
        raise


def run_examples():
    """运行示例"""
    try:
        # 示例1: 搜索电影
        print('示例1: 搜索电影 - 关键词: "星际"')
        search_result = search_movies("星际")
        print(json.dumps(search_result, indent=2, ensure_ascii=False))
        print("\n-------------------------------------------\n")

        # 示例2: 获取电影详情
        print('示例2: 获取电影详情 - ID: "mock1"')
        movie_detail = get_movie_detail("mock1")
        print(json.dumps(movie_detail, indent=2, ensure_ascii=False))
        print("\n-------------------------------------------\n")

        # 示例3: 获取电影推荐
        print("示例3: 获取电影推荐 - 科幻类型，评分8-10")
        recommend_params = {"genres": ["科幻"], "rating_range": "8-10", "limit": 3}
        recommendations = get_recommendations(recommend_params)
        print(json.dumps(recommendations, indent=2, ensure_ascii=False))

    except Exception as e:
        print(f"示例运行失败: {e}")


if __name__ == "__main__":
    run_examples()
