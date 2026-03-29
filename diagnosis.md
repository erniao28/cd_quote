# 问题诊断：方案 A vs 方案 B

## 当前错误现象
```
[下载 Excel] 爬取详情页失败：26 光大银行 CD039 Navigation timeout of 15000 ms exceeded
[下载 Excel] 爬取详情页失败：26 恒丰银行 CD093 Navigation timeout of 15000 ms exceeded
```

## 方案对比

### 方案 A（有问题）- 详情页爬取
```javascript
for (const item of allItems) {
    await page.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 15000 });
    await page.goBack({ waitUntil: 'networkidle2', timeout: 15000 });
}
```

**问题根源**：
1. ❌ `page.goBack()` 在货币网这种复杂单页应用中极不稳定
2. ❌ 货币网使用 JavaScript 加载表格，`goBack()` 后表格状态丢失
3. ❌ 连续 60 次 `goto` + `goBack` 触发网站反爬限流
4. ❌ 每次超时 15 秒，累积延迟导致更多超时

### 方案 B（正常）- Excel 下载拦截
```javascript
page.on('response', async response => {
    if (contentType.includes('excel')) {
        excelBuffer = await response.buffer();
    }
});
// 点击导出按钮
```

**成功原因**：
1. ✅ 只访问列表页，不访问详情页
2. ✅ 直接拦截 Excel 文件响应
3. ✅ Excel 包含完整数据（收益率、期限、发行量、评级）
4. ✅ 无频繁页面跳转，不触发反爬

## 推荐解决方案

### 方案 1：优化详情页爬取（保留方案 A）
```javascript
// 使用新标签页而非 goBack
const detailPage = await browser.newPage();
await detailPage.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
// 爬取数据
await detailPage.close();  // 关闭详情页，返回列表页上下文
```

### 方案 2：纯 Excel 下载（方案 B 优化）
```javascript
// 1. 尝试拦截 Excel 下载
// 2. 如果失败，解析表格数据
// 3. 不爬取详情页，使用 Excel 已有数据
```

### 方案 3：混合模式（最可靠）
1. 优先 Excel 下载（获取完整字段）
2. 如果 Excel 失败，使用表格爬取
3. 详情页爬取仅作为最后补充手段
4. 使用并发控制（同时最多 5 个请求）

```
