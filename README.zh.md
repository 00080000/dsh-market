# dsh-market

[English](README.md) | 中文

装在 DeepSeek Harness 里的插件市场。打开设置 → **插件市场** → 逛一逛，点一下，装好。

![dsh-market](assets/demo.png)

## 安装

```sh
dsh plugin --profile web add dsh-market
```

重启 `dsh web`，打开 **设置 → 插件市场**。

## 你会得到

- **发现** — 完整社区目录（165+ 插件，每天在涨），可搜索、按分类筛选，中英双语描述
- **一键安装** — 确认来源，点安装，按提示重启。全程不碰终端
- **已安装** — 一眼看清 profile 里装了哪些社区插件

## 安全

- 只允许安装 [awesome-dsh-plugin](https://awesome-dsh-plugin.com) 精选列表内的来源，其它一律拒绝
- 构建脚本默认禁止执行（pnpm ≥10），放行与否由你按包显式决定
- 安装接口只接受同源 POST
- 收录 ≠ 背书：插件是第三方代码，请只安装你信任的来源

## 数据源

实时来自 [awesome-dsh-plugin.com/plugins.json](https://awesome-dsh-plugin.com/plugins.json)（列表合并即 CI 自动更新），内置快照做离线兜底。

## 路线图

主题商店 Tab（点击即换）、更新检测、卸载/启停、更多入口。

## 许可

MIT · [dshmarket.com](https://dshmarket.com)
