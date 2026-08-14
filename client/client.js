window.__ModuleLoader__.load({ id: "dshmarket", factory: (require) => {


		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/locales.ts
		/** zh/en dictionaries for the Market settings section and install toast. */
		const zh = {
			nav: "插件市场",
			subtitle: "发现社区为 DeepSeek Harness 打造的能力",
			searchPh: "搜索插件，比如：通知、终端、记忆…",
			tabDiscover: "发现",
			tabInstalled: "已安装",
			all: "全部",
			install: "安装",
			installing: "安装中…",
			installedBadge: "✓ 已装好",
			alreadyInstalled: "✓ 已安装",
			restartBanner: "项变更完成，重启 DeepSeek Harness 后生效",
			uninstall: "卸载",
			confirmRemove: "确认卸载？",
			uninstalling: "卸载中…",
			restartHint: "重启方式：关闭当前 dsh 进程后重新运行（例如 dsh web）",
			confirmTitle: "安装",
			confirmWarn: "插件是社区第三方代码。安装即表示你信任该来源；构建脚本默认被禁止执行。",
			cancel: "取消",
			empty: "没有匹配的插件",
			installedEmpty: "还没有装过社区插件，去「发现」页逛逛吧",
			loadFail: "插件目录加载失败，请稍后重试",
			installFail: "安装失败",
			viewSource: "源码",
			hotBanner: "个新插件已装好，刷新页面即可使用",
			refresh: "刷新页面",
			update: "更新",
			updating: "更新中…",
			updated: "✓ 已更新，重启后生效",
			updateFail: "更新失败",
			upToDate: "已是最新",
			linkedDev: "本地开发链接",
			exportLog: "导出日志",
			readme: "使用说明",
			terminalWarn: "这看起来是终端/命令行插件：装进网页版可能无效，甚至导致 DeepSeek Harness 无法启动。建议先看它的使用说明，按说明装进对应的 profile。",
			envMissing: "还差一个小组件才能安装插件",
			envFix: "自动装好",
			envFixing: "正在准备…",
			envFixFail: "自动准备没成功，请点\"导出日志\"把文件发给我们反馈",
			loading: "正在加载插件目录…",
			backTop: "回到顶部",
			confirm: "确认",
			cmdDetails: "安装命令",
			catsMore: "更多分类",
			catsLess: "收起",
			sortHot: "最热",
			sortNew: "最新",
			marketUpdate: "市场有新版本，升级",
			updateAll: "全部更新",
			tabThemes: "主题",
			themeApply: "使用",
			themeActive: "使用中",
			themeEmpty: "目录里暂时还没有主题，敬请期待",
			progressHint: "首次安装需要下载与解析依赖，大插件可能要 1-3 分钟",
			toastReady: "已装好并已生效",
			toastTheme: "已启用。到 设置 → 插件市场 → 主题 可随时切换",
			gotIt: "知道了"
		};
		const en = {
			nav: "Plugin Market",
			subtitle: "Discover community plugins for DeepSeek Harness",
			searchPh: "Search plugins: notify, terminal, memory…",
			tabDiscover: "Discover",
			tabInstalled: "Installed",
			all: "All",
			install: "Install",
			installing: "Installing…",
			installedBadge: "✓ Installed",
			alreadyInstalled: "✓ Installed",
			restartBanner: "change(s) done — restart DeepSeek Harness to apply",
			uninstall: "Uninstall",
			confirmRemove: "Confirm?",
			uninstalling: "Removing…",
			restartHint: "To restart: stop the current dsh process and run it again (e.g. dsh web)",
			confirmTitle: "Install",
			confirmWarn: "Plugins are third-party community code. Installing means you trust this source; build scripts are blocked by default.",
			cancel: "Cancel",
			empty: "No plugins match",
			installedEmpty: "No community plugins yet — browse the Discover tab",
			loadFail: "Failed to load the plugin catalog, please retry later",
			installFail: "Install failed",
			viewSource: "Source",
			hotBanner: "new plugin(s) ready — refresh the page to use them",
			refresh: "Refresh",
			update: "Update",
			updating: "Updating…",
			updated: "✓ Updated — restart to apply",
			updateFail: "Update failed",
			upToDate: "Up to date",
			linkedDev: "linked (dev)",
			exportLog: "Export log",
			readme: "README",
			terminalWarn: "This looks like a terminal/CLI plugin: installing it into the web profile may do nothing, or even break DeepSeek Harness startup. Read its README and install it into the profile it targets.",
			envMissing: "One small component is needed before installing plugins",
			envFix: "Set up automatically",
			envFixing: "Setting up…",
			envFixFail: "Automatic setup failed — please use \"Export log\" and send us the file",
			loading: "Loading the catalog…",
			backTop: "Back to top",
			confirm: "Confirm",
			cmdDetails: "Install command",
			catsMore: "More",
			catsLess: "Less",
			sortHot: "Top",
			sortNew: "New",
			marketUpdate: "Market update available — upgrade",
			updateAll: "Update all",
			tabThemes: "Themes",
			themeApply: "Use",
			themeActive: "Active",
			themeEmpty: "No more theme plugins in the catalog yet — stay tuned",
			progressHint: "First installs download and resolve dependencies — large plugins can take 1-3 minutes",
			toastReady: "installed and live",
			toastTheme: "is now active. Switch any time in Settings → Plugin Market → Themes",
			gotIt: "Got it"
		};
		//#endregion
		//#region src/client/market-data.ts
		function avatarColor(name) {
			let hash = 0;
			for (let i = 0; i < name.length; i++) hash = hash * 31 + name.charCodeAt(i) | 0;
			return "hsl(" + (hash % 360 + 360) % 360 + " 55% 52%)";
		}
		function repoOf(url) {
			const m = /^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\/tree\/.+)?\/?$/.exec(url);
			return m ? m[1] : null;
		}
		function readSession(key) {
			try {
				return JSON.parse(sessionStorage.getItem(key) || "null");
			} catch {
				return null;
			}
		}
		/** Heuristic: plugins that target a terminal surface rather than the web UI. */
		function looksTerminal(plugin, lang) {
			const desc = plugin.description && (plugin.description[lang] || plugin.description.en) || "";
			return /\b(tui|cli|tty|terminal)\b|终端|命令行/i.test(plugin.name + " " + desc);
		}
		/** A registry plugin counts as installed when its package name, npm name, or GitHub spec appears in the profile dependencies. */
		function isInstalled(plugin, installed) {
			if (installed[plugin.name] !== void 0) return true;
			if (plugin.npm && installed[plugin.npm] !== void 0) return true;
			const repo = repoOf(plugin.url);
			if (repo === null) return false;
			const needle = ("github:" + repo).toLowerCase();
			return Object.values(installed).some((spec) => String(spec).toLowerCase().includes(needle));
		}
		/**
		* The brand mark (assets/logo.svg — shared block-grid mark with
		* awesome-dsh-plugin), inlined so the header needs no extra request.
		*/
		const LOGO_URI = "data:image/svg+xml," + encodeURIComponent("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\"><rect width=\"128\" height=\"128\" rx=\"28\" fill=\"#f6f2ea\"/><g transform=\"translate(15.7 16.7) scale(0.3) translate(-112 -78)\"><g fill=\"#2b2620\"><rect x=\"112\" y=\"112\" width=\"88\" height=\"88\" rx=\"14\"/><rect x=\"212\" y=\"112\" width=\"88\" height=\"88\" rx=\"14\"/><rect x=\"112\" y=\"212\" width=\"88\" height=\"88\" rx=\"14\"/><rect x=\"212\" y=\"212\" width=\"88\" height=\"88\" rx=\"14\"/><rect x=\"112\" y=\"312\" width=\"88\" height=\"88\" rx=\"14\"/><rect x=\"212\" y=\"312\" width=\"88\" height=\"88\" rx=\"14\"/><rect x=\"312\" y=\"212\" width=\"88\" height=\"88\" rx=\"14\"/><rect x=\"312\" y=\"312\" width=\"88\" height=\"88\" rx=\"14\"/></g><rect x=\"346\" y=\"78\" width=\"88\" height=\"88\" rx=\"14\" fill=\"#c0392b\" transform=\"rotate(9 390 122)\"/></g></svg>");
		/** Four representative colors for a theme card's preview strip. */
		function themeSwatch(def) {
			const tk = def.tokens || {};
			const pick = (names) => {
				for (const n of names) if (tk[n]) return tk[n];
				return null;
			};
			const dark = def.colorScheme === "dark";
			return [
				pick(["--dsw-alias-bg-base", "--dsw-alias-bg-layer-1"]) || (dark ? "#0f1115" : "#ffffff"),
				pick(["--dsw-alias-bg-layer-2", "--dsw-alias-bg-overlay"]) || (dark ? "#1a1d23" : "#f3f4f6"),
				pick(["--dsw-alias-brand-primary"]) || "#4f6ef7",
				pick(["--dsw-alias-label-primary"]) || (dark ? "#e5e7eb" : "#1f2328")
			];
		}
		//#endregion
		//#region src/client/InstallToast.tsx
		/**
		* Post-reload confirmation via the official Toast primitive: shown once after
		* the refresh that follows a hot install or theme switch, so the user lands
		* back in their flow with visible proof.
		*/
		function InstallToast(props) {
			const t = props.t;
			const [mode] = (0, react.useState)(() => {
				const value = sessionStorage.getItem("dshm-toast-mode");
				sessionStorage.removeItem("dshm-toast-mode");
				return value;
			});
			const [names, setNames] = (0, react.useState)(() => {
				const value = readSession("dshm-toast");
				sessionStorage.removeItem("dshm-toast");
				return Array.isArray(value) ? value : [];
			});
			if (names.length === 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
				text: names.join(", ") + " " + t(mode === "theme" ? "toastTheme" : "toastReady"),
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "✨" }),
				onDone: () => setNames([])
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/fkysly/work/dshmarket/src/client/Market.module.css.mjs
		const css = ".TDaEaa_root{min-width:0;height:100%;color:var(--dsw-alias-label-primary,#1f2328);flex-direction:column;display:flex;position:relative}.TDaEaa_head{flex-direction:column;gap:12px;padding:4px 4px 12px;display:flex}.TDaEaa_title{margin:0;font-size:16px;font-weight:500;line-height:24px}.TDaEaa_sub{color:var(--dsw-alias-label-tertiary,#8b93a1);margin:0;font-size:14px;line-height:22px}.TDaEaa_searchInline{flex-shrink:0;width:200px;margin-bottom:6px}.TDaEaa_tabs{border-bottom:1px solid var(--dsw-alias-border-l2,#e5e7eb);align-items:flex-end;gap:2px;display:flex}.TDaEaa_tab{font:inherit;color:var(--dsw-alias-label-secondary,#6b7280);cursor:pointer;white-space:nowrap;background:0 0;border:none;border-bottom:2px solid #0000;padding:7px 12px;font-size:13px}.TDaEaa_tab.TDaEaa_on{color:var(--dsw-alias-brand-primary,#4f6ef7);border-bottom-color:var(--dsw-alias-brand-primary,#4f6ef7);font-weight:600}.TDaEaa_restart{background:var(--dsw-alias-bg-layer-2,#fdf3e3);border:1px solid var(--dsw-alias-border-l2,#f3e3c3);border-radius:8px;align-items:center;gap:8px;margin:0;padding:8px 12px;font-size:12px;display:flex}.TDaEaa_body{flex:1;padding:12px 4px 24px;overflow-x:hidden;overflow-y:auto}.TDaEaa_cats{z-index:5;background:var(--dsw-alias-bg-layer-2,#f7f8fa);margin:-12px -4px 2px;padding:12px 4px 4px;position:sticky;top:-13px}.TDaEaa_catsRow{align-items:flex-start;gap:8px;display:flex;position:relative}.TDaEaa_sort{background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l1,#e5e7eb);border-radius:8px;flex-shrink:0;gap:2px;padding:2px;display:flex}.TDaEaa_sort button{font:inherit;color:var(--dsw-alias-label-secondary,#6b7280);cursor:pointer;background:0 0;border:none;border-radius:6px;padding:3px 10px;font-size:12px}.TDaEaa_sort button.TDaEaa_on{background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#1f2328);font-weight:600;box-shadow:0 1px 3px #00000014}.TDaEaa_star{color:var(--dsw-alias-label-secondary,#9ca3af);font-size:11px}.TDaEaa_top{z-index:20;border:1px solid var(--dsw-alias-border-l1,#e5e7eb);background:var(--dsw-alias-bg-layer-1,#fff);width:38px;height:38px;color:var(--dsw-alias-label-secondary,#6b7280);cursor:pointer;border-radius:99px;font-size:16px;position:absolute;bottom:18px;right:18px;box-shadow:0 4px 14px #0000001f}.TDaEaa_top:hover{color:var(--dsw-alias-brand-primary,#4f6ef7)}.TDaEaa_tag{border:1px solid var(--dsw-alias-border-l3,#d9dde3);color:var(--dsw-alias-label-secondary,#6b7280);border-radius:4px;flex-shrink:0;padding:1px 6px;font-size:11px;line-height:16px}.TDaEaa_okState{color:var(--dsw-alias-state-success-primary,#16a34a);white-space:nowrap;font-size:12px;font-weight:600}.TDaEaa_dangerBtn.TDaEaa_dangerBtn{border-color:var(--dsw-alias-state-error-primary,#dc2626);color:var(--dsw-alias-state-error-primary,#dc2626)}.TDaEaa_dangerArmed.TDaEaa_dangerArmed{background:var(--dsw-alias-state-error-primary,#dc2626);color:#fff}.TDaEaa_warnBtn.TDaEaa_warnBtn{background:var(--dsw-alias-state-warn-primary,#ea580c);color:#fff}.TDaEaa_catsWrap{flex-wrap:wrap;flex:1;align-items:center;gap:6px;min-width:0;display:flex}.TDaEaa_catsCollapsed{max-height:62px;overflow:hidden}.TDaEaa_catsToggle.TDaEaa_catsToggle{height:26px;min-height:26px;color:var(--dsw-alias-label-secondary,#6b7280);padding:0 6px}.TDaEaa_cmdDetails{margin:0}.TDaEaa_cmdSummary{cursor:pointer;width:fit-content;color:var(--dsw-alias-label-secondary,#6b7280);border-radius:6px;align-items:center;gap:6px;margin-left:-4px;padding:2px 4px;font-size:12px;font-weight:500;line-height:18px;list-style:none;display:flex}.TDaEaa_cmdSummary::-webkit-details-marker{display:none}.TDaEaa_cmdSummary:before{content:\"\";border-bottom:1.5px solid;border-right:1.5px solid;width:5px;height:5px;transition:transform .12s;transform:rotate(-45deg)translate(-1px,-1px)}.TDaEaa_cmdDetails[open]>.TDaEaa_cmdSummary:before{transform:rotate(45deg)translate(-1px,-1px)}.TDaEaa_cmdSummary:hover{color:var(--dsw-alias-label-primary,#1f2328)}.TDaEaa_cmd{background:var(--dsw-alias-bg-layer-2,#f3f4f6);word-break:break-all;border-radius:6px;margin:8px 0 0;padding:8px 10px;font-family:ui-monospace,Menlo,monospace;font-size:11px;line-height:18px}.TDaEaa_warnLine{color:var(--dsw-alias-state-warn-primary,#b45309);margin:0;font-size:12px;font-weight:600;line-height:18px}.TDaEaa_modalNote{color:var(--dsw-alias-label-tertiary,#8b93a1);margin:12px 0 0;font-size:12px;line-height:18px}.TDaEaa_grid{grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;display:grid}.TDaEaa_sect{color:var(--dsw-alias-label-secondary,#6b7280);margin:14px 2px 8px;font-size:12px;font-weight:600}.TDaEaa_sect:first-child{margin-top:2px}.TDaEaa_swatches{border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:8px;gap:0;height:34px;display:flex;overflow:hidden}.TDaEaa_themesGrid{margin-bottom:12px}.TDaEaa_swatches i{flex:1}.TDaEaa_card{background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:12px;flex-direction:column;gap:12px;padding:12px 14px;display:flex}.TDaEaa_row1{align-items:center;gap:10px;min-width:0;display:flex}.TDaEaa_av{color:#fff;object-fit:cover;background:var(--dsw-alias-bg-layer-2,#f3f4f6);border-radius:8px;flex-shrink:0;place-items:center;width:32px;height:32px;font-size:14px;font-weight:700;display:grid}.TDaEaa_nm{text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:500;line-height:22px;overflow:hidden}.TDaEaa_owner{color:var(--dsw-alias-label-secondary,#9ca3af);font-size:11px}.TDaEaa_desc{color:var(--dsw-alias-label-tertiary,#8b93a1);min-height:36px;margin:0;font-size:12px;line-height:18px}.TDaEaa_foot{align-items:center;gap:8px;margin-top:auto;display:flex}.TDaEaa_grow{flex:1}.TDaEaa_titleRow{align-items:center;gap:10px;display:flex}.TDaEaa_descTight{min-height:0}.TDaEaa_src{color:var(--dsw-alias-label-secondary,#9ca3af);font-size:11px;text-decoration:none}.TDaEaa_src:hover{color:var(--dsw-alias-brand-primary,#4f6ef7)}.TDaEaa_dot{vertical-align:2px;margin-left:5px}.TDaEaa_loading{color:var(--dsw-alias-label-secondary,#9ca3af);flex-direction:column;align-items:center;gap:12px;padding:48px;font-size:13px;display:flex}.TDaEaa_spin{border:3px solid var(--dsw-alias-border-l1,#e5e7eb);border-top-color:var(--dsw-alias-brand-primary,#4f6ef7);border-radius:99px;width:22px;height:22px;animation:.8s linear infinite TDaEaa_sp}@keyframes TDaEaa_sp{to{transform:rotate(360deg)}}.TDaEaa_progress{background:var(--dsw-alias-bg-layer-2,#f3f4f6);border:1px solid var(--dsw-alias-border-l2,#e5e7eb);color:var(--dsw-alias-label-secondary,#6b7280);border-radius:8px;align-items:center;gap:9px;margin:0;padding:8px 12px;font-size:12px;display:flex}.TDaEaa_irow .TDaEaa_progress{margin-top:8px}.TDaEaa_progress .TDaEaa_spin{border-width:2px;flex-shrink:0;width:14px;height:14px}.TDaEaa_progress code{text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,Menlo,monospace;font-size:11px;overflow:hidden}.TDaEaa_empty{color:var(--dsw-alias-label-secondary,#9ca3af);text-align:center;padding:32px;font-size:13px}.TDaEaa_err{color:var(--dsw-alias-state-error-primary,#dc2626);white-space:pre-wrap;word-break:break-all;margin:8px 0;font-size:12px}.TDaEaa_irow{background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:12px;align-items:center;gap:10px;margin-bottom:8px;padding:12px 14px;display:flex}.TDaEaa_irow>.TDaEaa_src,.TDaEaa_irow>.TDaEaa_owner,.TDaEaa_irow>.TDaEaa_btn{white-space:nowrap;flex-shrink:0}.TDaEaa_spec{color:var(--dsw-alias-label-secondary,#9ca3af);font-family:ui-monospace,Menlo,monospace;font-size:11px}";
		const tagId = "dshmarket/Market.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dshmarket";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var Market_module_css_default = {
			"warnLine": "TDaEaa_warnLine",
			"catsWrap": "TDaEaa_catsWrap",
			"sort": "TDaEaa_sort",
			"cmdSummary": "TDaEaa_cmdSummary",
			"grid": "TDaEaa_grid",
			"desc": "TDaEaa_desc",
			"catsToggle": "TDaEaa_catsToggle",
			"row1": "TDaEaa_row1",
			"spec": "TDaEaa_spec",
			"catsCollapsed": "TDaEaa_catsCollapsed",
			"modalNote": "TDaEaa_modalNote",
			"tabs": "TDaEaa_tabs",
			"nm": "TDaEaa_nm",
			"card": "TDaEaa_card",
			"okState": "TDaEaa_okState",
			"title": "TDaEaa_title",
			"cmd": "TDaEaa_cmd",
			"foot": "TDaEaa_foot",
			"warnBtn": "TDaEaa_warnBtn",
			"star": "TDaEaa_star",
			"catsRow": "TDaEaa_catsRow",
			"root": "TDaEaa_root",
			"tab": "TDaEaa_tab",
			"swatches": "TDaEaa_swatches",
			"dangerBtn": "TDaEaa_dangerBtn",
			"grow": "TDaEaa_grow",
			"top": "TDaEaa_top",
			"titleRow": "TDaEaa_titleRow",
			"src": "TDaEaa_src",
			"progress": "TDaEaa_progress",
			"sect": "TDaEaa_sect",
			"sp": "TDaEaa_sp",
			"dangerArmed": "TDaEaa_dangerArmed",
			"descTight": "TDaEaa_descTight",
			"themesGrid": "TDaEaa_themesGrid",
			"tag": "TDaEaa_tag",
			"owner": "TDaEaa_owner",
			"restart": "TDaEaa_restart",
			"loading": "TDaEaa_loading",
			"empty": "TDaEaa_empty",
			"dot": "TDaEaa_dot",
			"spin": "TDaEaa_spin",
			"cmdDetails": "TDaEaa_cmdDetails",
			"head": "TDaEaa_head",
			"on": "TDaEaa_on",
			"av": "TDaEaa_av",
			"irow": "TDaEaa_irow",
			"sub": "TDaEaa_sub",
			"searchInline": "TDaEaa_searchInline",
			"btn": "TDaEaa_btn",
			"body": "TDaEaa_body",
			"cats": "TDaEaa_cats",
			"err": "TDaEaa_err"
		};
		//#endregion
		//#region src/client/MarketSection.tsx
		/**
		* The Market settings section: Discover / Themes / Installed tabs over the
		* /dsh-market/* host routes, with install/update/uninstall flows and the
		* pending-restart bookkeeping in sessionStorage.
		*/
		/**
		* Card avatar: the plugin owner's GitHub avatar (no API, browser-cached),
		* falling back to the initial-letter tile when it can't load.
		*/
		function OwnerAvatar({ name, owner }) {
			const [failed, setFailed] = (0, react.useState)(false);
			if (failed || owner === "") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: Market_module_css_default.av,
				style: { background: avatarColor(name) },
				children: name.replace(/^dsh[-_]/i, "").charAt(0).toUpperCase() || "P"
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
				className: Market_module_css_default.av,
				src: `https://github.com/${encodeURIComponent(owner)}.png?size=96`,
				alt: "",
				loading: "lazy",
				onError: () => setFailed(true)
			});
		}
		function MarketSection(props) {
			const t = props.t;
			const localeSnap = (0, react.useSyncExternalStore)((cb) => props.locale.subscribe(cb), () => props.locale.getSnapshot());
			const lang = String(localeSnap.active).toLowerCase().startsWith("zh") ? "zh" : "en";
			const themeSnap = (0, react.useSyncExternalStore)(props.themeStore.subscribe, props.themeStore.getSnapshot);
			const [data, setData] = (0, react.useState)(null);
			const [loadError, setLoadError] = (0, react.useState)(false);
			const [installed, setInstalled] = (0, react.useState)({});
			const [skins, setSkins] = (0, react.useState)([]);
			const [tab, setTab] = (0, react.useState)(() => {
				const saved = sessionStorage.getItem("dshm-tab");
				if (saved !== null) sessionStorage.removeItem("dshm-tab");
				return saved || "discover";
			});
			const [q, setQ] = (0, react.useState)("");
			const [cat, setCat] = (0, react.useState)("all");
			const [confirming, setConfirming] = (0, react.useState)(null);
			const [busyUrl, setBusyUrl] = (0, react.useState)(null);
			const [doneUrls, setDoneUrls] = (0, react.useState)([]);
			const [installError, setInstallError] = (0, react.useState)(null);
			const [updates, setUpdates] = (0, react.useState)({});
			const [updatingName, setUpdatingName] = (0, react.useState)(null);
			const [updatingAll, setUpdatingAll] = (0, react.useState)(false);
			const [updatedNames, setUpdatedNames] = (0, react.useState)([]);
			const [hotUrls, setHotUrls] = (0, react.useState)([]);
			const [hotNames, setHotNames] = (0, react.useState)([]);
			const [progressLine, setProgressLine] = (0, react.useState)(null);
			const [removeArmed, setRemoveArmed] = (0, react.useState)(null);
			const [removingName, setRemovingName] = (0, react.useState)(null);
			const [removedCount, setRemovedCount] = (0, react.useState)(0);
			const [envReady, setEnvReady] = (0, react.useState)(true);
			const [envFixing, setEnvFixing] = (0, react.useState)(false);
			const [envFailed, setEnvFailed] = (0, react.useState)(false);
			const [bootId, setBootId] = (0, react.useState)(null);
			const [showTop, setShowTop] = (0, react.useState)(false);
			const bodyRef = (0, react.useRef)(null);
			const [sort, setSort] = (0, react.useState)("hot");
			const [catsOpen, setCatsOpen] = (0, react.useState)(false);
			const [visibleCats, setVisibleCats] = (0, react.useState)(null);
			const catsWrapRef = (0, react.useRef)(null);
			const refreshInstalled = (0, react.useCallback)((force) => {
				fetch("/dsh-market/installed", { cache: "no-store" }).then((res) => res.json()).then((body) => {
					setInstalled(body.installed || {});
					setSkins(body.live || []);
				}).catch(() => {});
				fetch("/dsh-market/updates" + (force === true ? "?force=1" : ""), { cache: "no-store" }).then((res) => res.json()).then((body) => setUpdates(body.updates || {})).catch(() => {});
			}, []);
			(0, react.useEffect)(() => {
				fetch("/dsh-market/registry", { cache: "no-store" }).then((res) => {
					if (!res.ok) throw new Error("HTTP " + res.status);
					return res.json();
				}).then((body) => setData(body.registry)).catch(() => setLoadError(true));
				fetch("/dsh-market/status", { cache: "no-store" }).then((res) => res.json()).then((status) => {
					setEnvReady(status.pnpm !== false);
					if (typeof status.boot === "string") setBootId(status.boot);
				}).catch(() => {});
				refreshInstalled();
			}, [refreshInstalled]);
			(0, react.useEffect)(() => {
				if (bootId === null) return;
				const saved = readSession("dshm-restart");
				if (saved === null) return;
				if (saved.boot !== bootId) {
					sessionStorage.removeItem("dshm-restart");
					return;
				}
				if (Array.isArray(saved.doneUrls) && saved.doneUrls.length > 0) setDoneUrls(saved.doneUrls);
				if (Array.isArray(saved.updated) && saved.updated.length > 0) setUpdatedNames(saved.updated);
				if (typeof saved.removed === "number" && saved.removed > 0) setRemovedCount(saved.removed);
			}, [bootId]);
			(0, react.useEffect)(() => {
				if (bootId === null) return;
				if (doneUrls.length === 0 && updatedNames.length === 0 && removedCount === 0) return;
				sessionStorage.setItem("dshm-restart", JSON.stringify({
					boot: bootId,
					doneUrls,
					updated: updatedNames,
					removed: removedCount
				}));
			}, [
				bootId,
				doneUrls,
				updatedNames,
				removedCount
			]);
			const fixEnv = (0, react.useCallback)(() => {
				setEnvFixing(true);
				setEnvFailed(false);
				fetch("/dsh-market/setup-pnpm", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: "{}"
				}).then((res) => res.json()).then((body) => {
					if (body.ok) setEnvReady(true);
					else setEnvFailed(true);
				}).catch(() => setEnvFailed(true)).finally(() => setEnvFixing(false));
			}, []);
			(0, react.useEffect)(() => {
				const pending = readSession("dshm-pending");
				if (pending !== null && typeof pending.url === "string") setBusyUrl(pending.url);
			}, []);
			(0, react.useEffect)(() => {
				if (busyUrl === null && updatingName === null) {
					setProgressLine(null);
					return;
				}
				const timer = setInterval(() => {
					fetch("/dsh-market/status", { cache: "no-store" }).then((res) => res.json()).then((status) => {
						if (status.active) setProgressLine((status.lastLine || "…") + "  (" + status.seconds + "s)");
						else {
							setProgressLine(null);
							setInstalled(status.installed || {});
							if (readSession("dshm-pending") !== null && busyUrl !== null) {
								if (data !== null && data.plugins.some((p) => p.url === busyUrl && isInstalled(p, status.installed || {}))) {
									sessionStorage.removeItem("dshm-pending");
									setDoneUrls((urls) => urls.includes(busyUrl) ? urls : urls.concat(busyUrl));
									setBusyUrl(null);
								}
							}
						}
					}).catch(() => {});
				}, 2e3);
				return () => clearInterval(timer);
			}, [
				busyUrl,
				updatingName,
				data
			]);
			const plugins = (0, react.useMemo)(() => {
				if (data === null) return [];
				const query = q.trim().toLowerCase();
				const list = data.plugins.filter((p) => {
					if (cat !== "all" && p.category !== cat) return false;
					if (query === "") return true;
					const desc = p.description && (p.description[lang] || p.description.en) || "";
					return p.name.toLowerCase().includes(query) || p.owner.toLowerCase().includes(query) || desc.toLowerCase().includes(query);
				});
				if (sort === "hot") return [...list].sort((a, b) => (b.stars ?? -1) - (a.stars ?? -1));
				if (sort === "new") return [...list].sort((a, b) => String(b.added).localeCompare(String(a.added)));
				return list;
			}, [
				data,
				q,
				cat,
				lang,
				sort
			]);
			const doInstall = (0, react.useCallback)((plugin) => {
				setConfirming(null);
				setInstallError(null);
				setBusyUrl(plugin.url);
				sessionStorage.setItem("dshm-pending", JSON.stringify({ url: plugin.url }));
				fetch("/dsh-market/install", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ url: plugin.url })
				}).then((res) => res.json().then((body) => ({
					status: res.status,
					body
				}))).then(({ status, body }) => {
					sessionStorage.removeItem("dshm-pending");
					if (status === 200 && body.ok && body.hot && plugin.category === "theme") {
						sessionStorage.setItem("dshm-toast", JSON.stringify([plugin.name]));
						sessionStorage.setItem("dshm-tab", "themes");
						location.reload();
						return;
					}
					if (status === 200 && body.ok) {
						sessionStorage.setItem("dshm-tab", "installed");
						if (body.hot) {
							setHotUrls((urls) => urls.includes(plugin.url) ? urls : urls.concat(plugin.url));
							setHotNames((names) => names.includes(plugin.name) ? names : names.concat(plugin.name));
						} else setDoneUrls((urls) => urls.includes(plugin.url) ? urls : urls.concat(plugin.url));
						refreshInstalled();
					} else {
						const text = (v) => typeof v === "string" ? v : v && typeof v.text === "string" ? v.text : v == null ? "" : JSON.stringify(v);
						const detail = text(body.error) || text(body.stderr) || text(body.stdout) || "exit " + body.exitCode;
						setInstallError(t("installFail") + ": " + plugin.name + " — " + detail.trim().slice(-600));
					}
				}).catch((error) => {
					sessionStorage.removeItem("dshm-pending");
					setInstallError(t("installFail") + ": " + String(error));
				}).finally(() => setBusyUrl(null));
			}, [refreshInstalled, t]);
			const doUpdate = (0, react.useCallback)((name) => {
				setInstallError(null);
				setUpdatingName(name);
				return fetch("/dsh-market/update", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ name })
				}).then((res) => res.json().then((body) => ({
					status: res.status,
					body
				}))).then(({ status, body }) => {
					if (status === 200 && body.ok) {
						setUpdatedNames((names) => names.concat(name));
						refreshInstalled();
					} else {
						const text = (v) => typeof v === "string" ? v : v && typeof v.text === "string" ? v.text : v == null ? "" : JSON.stringify(v);
						const detail = text(body.error) || text(body.stderr) || text(body.stdout) || "exit " + body.exitCode;
						setInstallError(t("updateFail") + ": " + name + " — " + detail.trim().slice(-600));
					}
				}).catch((error) => setInstallError(t("updateFail") + ": " + String(error))).finally(() => setUpdatingName(null));
			}, [refreshInstalled, t]);
			const doUseSkin = (0, react.useCallback)((name) => {
				setInstallError(null);
				fetch("/dsh-market/use-skin", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ name })
				}).then((res) => res.json().then((body) => ({
					status: res.status,
					body
				}))).then(({ status, body }) => {
					if (status === 200 && body.ok) {
						sessionStorage.setItem("dshm-toast", JSON.stringify([name]));
						sessionStorage.setItem("dshm-toast-mode", "theme");
						sessionStorage.setItem("dshm-tab", "themes");
						location.reload();
					} else setInstallError(String(body.error || "failed"));
				}).catch((error) => setInstallError(String(error)));
			}, []);
			const doUninstall = (0, react.useCallback)((name) => {
				setRemoveArmed(null);
				setInstallError(null);
				setRemovingName(name);
				return fetch("/dsh-market/uninstall", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ name })
				}).then((res) => res.json().then((body) => ({
					status: res.status,
					body
				}))).then(({ status, body }) => {
					if (status === 200 && body.ok) {
						if (!body.hot) setRemovedCount((n) => n + 1);
						refreshInstalled();
					} else {
						const text = (v) => typeof v === "string" ? v : v && typeof v.text === "string" ? v.text : v == null ? "" : JSON.stringify(v);
						setInstallError((text(body.error) || text(body.stderr) || "error").trim().slice(-600));
					}
				}).catch((error) => setInstallError(String(error))).finally(() => setRemovingName(null));
			}, [refreshInstalled]);
			const selfName = installed["dshmarket"] !== void 0 ? "dshmarket" : "dsh-market";
			const updatableNames = Object.keys(installed).filter((name) => name !== selfName && !updatedNames.includes(name) && updates[name] && updates[name].updateAvailable);
			const doUpdateAll = (0, react.useCallback)(() => {
				const names = updatableNames.slice();
				setUpdatingAll(true);
				const next = () => {
					const name = names.shift();
					if (name === void 0) {
						setUpdatingAll(false);
						return;
					}
					doUpdate(name).then(next, next);
				};
				next();
			}, [updatableNames, doUpdate]);
			const pendingRestart = doneUrls.length + updatedNames.length + removedCount;
			const hasUpdates = Object.keys(installed).some((name) => !updatedNames.includes(name) && updates[name] && updates[name].updateAvailable);
			const themePlugins = data === null ? [] : data.plugins.filter((p) => p.category === "theme").sort((a, b) => (b.stars || 0) - (a.stars || 0));
			const pluginCard = (p) => {
				const desc = p.description && (p.description[lang] || p.description.en) || "";
				const done = doneUrls.includes(p.url) || hotUrls.includes(p.url);
				const already = isInstalled(p, installed);
				const busy = busyUrl === p.url;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: Market_module_css_default.card,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: Market_module_css_default.row1,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(OwnerAvatar, {
									name: p.name,
									owner: p.owner || ""
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: { minWidth: 0 },
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: Market_module_css_default.nm,
										children: p.name
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: Market_module_css_default.owner,
										children: [p.owner, typeof p.stars === "number" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: Market_module_css_default.star,
											children: " · ★ " + p.stars
										})]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: Market_module_css_default.grow }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
									className: Market_module_css_default.src,
									href: p.url,
									target: "_blank",
									rel: "noreferrer",
									style: {
										alignSelf: "flex-start",
										flexShrink: 0
									},
									children: t("viewSource")
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: Market_module_css_default.desc,
							children: desc
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: Market_module_css_default.foot,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: Market_module_css_default.tag,
									children: data.categories[p.category] && (data.categories[p.category][lang] || data.categories[p.category].en) || p.category
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: Market_module_css_default.grow }),
								done ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: Market_module_css_default.okState,
									children: t("installedBadge")
								}) : already ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: Market_module_css_default.okState,
									children: t("alreadyInstalled")
								}) : busy ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "primary",
									size: "sm",
									disabled: true,
									children: t("installing")
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "primary",
									size: "sm",
									disabled: busyUrl !== null || !envReady,
									onClick: () => setConfirming(p),
									children: t("install")
								})
							]
						}),
						busy && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: Market_module_css_default.progress,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: Market_module_css_default.spin }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
								className: Market_module_css_default.grow,
								children: progressLine || t("progressHint")
							})]
						})
					]
				}, p.url);
			};
			const installedNameOf = (p) => {
				if (installed[p.name] !== void 0) return p.name;
				const repo = repoOf(p.url);
				if (repo === null) return null;
				const needle = ("github:" + repo).toLowerCase();
				for (const [name, spec] of Object.entries(installed)) if (String(spec).toLowerCase().includes(needle)) return name;
				return null;
			};
			const bootEntries = typeof window !== "undefined" && window.__DSH_BOOT__ && Array.isArray(window.__DSH_BOOT__.entries) ? window.__DSH_BOOT__.entries : [];
			const themePluginCard = (p) => {
				const instName = installedNameOf(p);
				if (instName === null) return pluginCard(p);
				const mounted = skins.includes(instName) || bootEntries.some((e) => e.id === instName);
				const desc = p.description && (p.description[lang] || p.description.en) || "";
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: Market_module_css_default.card,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: Market_module_css_default.row1,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(OwnerAvatar, {
									name: p.name,
									owner: p.owner || ""
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: { minWidth: 0 },
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: Market_module_css_default.nm,
										children: p.name
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: Market_module_css_default.owner,
										children: [p.owner, typeof p.stars === "number" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: Market_module_css_default.star,
											children: " · ★ " + p.stars
										})]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: Market_module_css_default.grow }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
									className: Market_module_css_default.src,
									href: p.url,
									target: "_blank",
									rel: "noreferrer",
									style: {
										alignSelf: "flex-start",
										flexShrink: 0
									},
									children: t("viewSource")
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: Market_module_css_default.desc,
							children: desc
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: Market_module_css_default.foot,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: Market_module_css_default.grow }),
								removingName === instName ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									size: "sm",
									className: Market_module_css_default.dangerBtn,
									disabled: true,
									children: t("uninstalling")
								}) : removeArmed === instName ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "primary",
									size: "sm",
									className: Market_module_css_default.dangerArmed,
									onClick: () => doUninstall(instName).then(() => {
										if (mounted) {
											sessionStorage.setItem("dshm-tab", "themes");
											location.reload();
										}
									}),
									children: t("confirmRemove")
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									size: "sm",
									className: Market_module_css_default.dangerBtn,
									onClick: () => setRemoveArmed(instName),
									children: t("uninstall")
								}),
								mounted ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: Market_module_css_default.okState,
									children: t("themeActive")
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "primary",
									size: "sm",
									onClick: () => doUseSkin(instName),
									children: t("themeApply")
								})
							]
						})
					]
				}, p.url);
			};
			const themeCard = (id, label, swatch) => {
				const active = themeSnap !== null && themeSnap.preference === id;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: Market_module_css_default.card,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: Market_module_css_default.swatches,
						children: swatch.map((c, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", { style: { background: c } }, i))
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: Market_module_css_default.foot,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: Market_module_css_default.nm,
								children: label
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: Market_module_css_default.grow }),
							active ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: Market_module_css_default.okState,
								children: t("themeActive")
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "primary",
								size: "sm",
								onClick: () => {
									try {
										props.theme.setTheme(id);
									} catch (error) {
										setInstallError(String(error));
									}
								},
								children: t("themeApply")
							})
						]
					})]
				}, "th-" + id);
			};
			const categories = data === null ? [] : Object.keys(data.categories);
			(0, react.useLayoutEffect)(() => {
				setVisibleCats(null);
			}, [lang, categories.length]);
			(0, react.useLayoutEffect)(() => {
				if (catsOpen || visibleCats !== null) return;
				const el = catsWrapRef.current;
				if (el === null) return;
				const chips = [...el.children].filter((c) => c.dataset?.chip === "1");
				if (chips.length === 0) return;
				const first = chips[0];
				const rowThreeTop = first.offsetTop + (first.offsetHeight + 6) * 2 - 3;
				let fits = 0;
				for (const chip of chips) if (chip.offsetTop < rowThreeTop) fits += 1;
				setVisibleCats(fits >= chips.length ? fits : Math.max(1, fits - 1));
			}, [
				catsOpen,
				visibleCats,
				data
			]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: Market_module_css_default.root,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: Market_module_css_default.head,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: Market_module_css_default.titleRow,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
										src: LOGO_URI,
										width: 22,
										height: 22,
										alt: "",
										style: {
											borderRadius: "5px",
											flexShrink: 0
										}
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
										className: Market_module_css_default.title,
										children: t("nav")
									}),
									(() => {
										const self = installed["dshmarket"] !== void 0 ? "dshmarket" : "dsh-market";
										return updates[self] && updates[self].updateAvailable && !updatedNames.includes(self) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "primary",
											size: "sm",
											className: Market_module_css_default.warnBtn,
											disabled: updatingName !== null || busyUrl !== null,
											onClick: () => {
												setTab("installed");
												doUpdate(self);
											},
											children: updatingName === self ? t("updating") : t("marketUpdate")
										});
									})(),
									updatableNames.length >= 2 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "primary",
										size: "sm",
										className: Market_module_css_default.warnBtn,
										disabled: updatingAll || updatingName !== null || busyUrl !== null || removingName !== null,
										onClick: () => {
											setTab("installed");
											doUpdateAll();
										},
										children: updatingAll ? t("updating") : t("updateAll") + " (" + updatableNames.length + ")"
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: Market_module_css_default.sub,
								children: [t("subtitle") + (data ? " · " + data.count : "") + " · ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
									className: Market_module_css_default.src,
									href: "/dsh-market/logs",
									download: "dsh-market-log.txt",
									children: t("exportLog")
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: Market_module_css_default.tabs,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: tab === "discover" ? `${Market_module_css_default.tab} ${Market_module_css_default.on}` : Market_module_css_default.tab,
										onClick: () => setTab("discover"),
										children: t("tabDiscover")
									}),
									themeSnap !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: tab === "themes" ? `${Market_module_css_default.tab} ${Market_module_css_default.on}` : Market_module_css_default.tab,
										onClick: () => setTab("themes"),
										children: t("tabThemes")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										className: tab === "installed" ? `${Market_module_css_default.tab} ${Market_module_css_default.on}` : Market_module_css_default.tab,
										onClick: () => {
											setTab("installed");
											refreshInstalled(true);
										},
										children: [t("tabInstalled") + (Object.keys(installed).length > 0 ? " (" + Object.keys(installed).length + ")" : ""), hasUpdates && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, {
											state: "error",
											size: 7,
											className: Market_module_css_default.dot
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: Market_module_css_default.grow }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
										className: Market_module_css_default.searchInline,
										icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutline16, { size: 14 }),
										placeholder: t("searchPh"),
										value: q,
										onChange: (e) => setQ(e.target.value)
									})
								]
							}),
							!envReady && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: Market_module_css_default.restart,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "🧩" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: Market_module_css_default.grow,
										children: envFailed ? t("envFixFail") : t("envMissing")
									}),
									!envFailed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "primary",
										size: "sm",
										disabled: envFixing,
										onClick: fixEnv,
										children: envFixing ? t("envFixing") : t("envFix")
									})
								]
							}),
							hotUrls.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: Market_module_css_default.restart,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "✨" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: Market_module_css_default.grow,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: hotUrls.length }),
											" ",
											t("hotBanner")
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "primary",
										size: "sm",
										onClick: () => {
											sessionStorage.setItem("dshm-toast", JSON.stringify(hotNames));
											sessionStorage.setItem("dshm-tab", "installed");
											location.reload();
										},
										children: t("refresh")
									})
								]
							}),
							pendingRestart > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: Market_module_css_default.restart,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "🔄" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: Market_module_css_default.grow,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: pendingRestart }),
											" ",
											t("restartBanner")
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										title: t("restartHint"),
										children: "ℹ️"
									})
								]
							})
						]
					}),
					installError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: Market_module_css_default.err,
						children: installError
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: Market_module_css_default.body,
						ref: bodyRef,
						onScroll: (e) => setShowTop(e.currentTarget.scrollTop > 400),
						children: tab === "discover" ? loadError ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: Market_module_css_default.empty,
							children: t("loadFail")
						}) : data === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: Market_module_css_default.loading,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: Market_module_css_default.spin }), t("loading")]
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: Market_module_css_default.cats,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: Market_module_css_default.catsRow,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									ref: catsWrapRef,
									className: catsOpen || visibleCats === null ? `${Market_module_css_default.catsWrap} ${Market_module_css_default.catsCollapsed}` : Market_module_css_default.catsWrap,
									children: (() => {
										const ordered = catsOpen || cat === "all" ? categories : [cat, ...categories.filter((id) => id !== cat)];
										const shown = catsOpen || visibleCats === null ? ordered : ordered.slice(0, Math.max(0, visibleCats - 1));
										return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
												"data-chip": "1",
												active: cat === "all",
												onClick: () => setCat("all"),
												children: t("all")
											}),
											shown.map((id) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
												"data-chip": "1",
												active: cat === id,
												onClick: () => setCat(id),
												children: data.categories[id] && (data.categories[id][lang] || data.categories[id].en) || id
											}, id)),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
												variant: "ghost",
												size: "sm",
												className: Market_module_css_default.catsToggle,
												icon: catsOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronUpOutline14, { size: 14 }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, { size: 14 }),
												"aria-label": catsOpen ? t("catsLess") : t("catsMore"),
												onClick: () => setCatsOpen((o) => !o)
											})
										] });
									})()
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: Market_module_css_default.sort,
									children: ["hot", "new"].map((key) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: sort === key ? Market_module_css_default.on : "",
										onClick: () => setSort(key),
										children: t(key === "hot" ? "sortHot" : "sortNew")
									}, key))
								})]
							})
						}), plugins.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: Market_module_css_default.empty,
							children: t("empty")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: Market_module_css_default.grid,
							children: plugins.map(pluginCard)
						})] }) : tab === "themes" && themeSnap !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(() => {
							const extra = themeSnap.themes.filter((def) => def.id !== "light" && def.id !== "dark");
							return extra.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: `${Market_module_css_default.grid} ${Market_module_css_default.themesGrid}`,
								children: extra.map((def) => themeCard(def.id, def.id, themeSwatch(def)))
							});
						})(), data === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: Market_module_css_default.loading,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: Market_module_css_default.spin }), t("loading")]
						}) : themePlugins.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: Market_module_css_default.empty,
							children: t("themeEmpty")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: Market_module_css_default.grid,
							children: themePlugins.map(themePluginCard)
						})] }) : Object.keys(installed).length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: Market_module_css_default.empty,
							children: t("installedEmpty")
						}) : Object.entries(installed).map(([name, spec]) => {
							const entry = data === null ? void 0 : data.plugins.find((p) => p.name === name || repoOf(p.url) !== null && String(spec).toLowerCase().includes(("github:" + repoOf(p.url)).toLowerCase()));
							const status = updates[name];
							const version = status && status.version ? "v" + status.version : "";
							const specText = String(spec);
							const ghSpec = /^github:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:#|$)/.exec(specText);
							const repoUrl = entry !== void 0 ? entry.url : ghSpec !== null ? "https://github.com/" + ghSpec[1] : null;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: Market_module_css_default.irow,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										style: { minWidth: 0 },
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: Market_module_css_default.nm,
												children: [name, version && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: Market_module_css_default.owner,
													children: " " + version
												})]
											}),
											repoUrl !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
												className: `${Market_module_css_default.spec} ${Market_module_css_default.src}`,
												href: repoUrl,
												target: "_blank",
												rel: "noreferrer",
												style: { display: "inline-block" },
												children: specText
											}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: Market_module_css_default.spec,
												children: specText
											}),
											entry !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: `${Market_module_css_default.desc} ${Market_module_css_default.descTight}`,
												children: entry.description && (entry.description[lang] || entry.description.en) || ""
											}),
											updatingName === name && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: Market_module_css_default.progress,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: Market_module_css_default.spin }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
													className: Market_module_css_default.grow,
													children: progressLine || t("progressHint")
												})]
											})
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: Market_module_css_default.grow }),
									repoUrl !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
										className: Market_module_css_default.src,
										href: repoUrl + "#readme",
										target: "_blank",
										rel: "noreferrer",
										children: t("readme")
									}),
									updatedNames.includes(name) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: Market_module_css_default.okState,
										children: t("updated")
									}) : updatingName === name ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "primary",
										size: "sm",
										className: Market_module_css_default.warnBtn,
										disabled: true,
										children: t("updating")
									}) : status && status.updateAvailable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "primary",
										size: "sm",
										className: Market_module_css_default.warnBtn,
										disabled: updatingName !== null,
										onClick: () => doUpdate(name),
										children: t("update")
									}) : status && status.kind === "linked" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: Market_module_css_default.owner,
										children: t("linkedDev")
									}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: Market_module_css_default.owner,
										children: t("upToDate")
									}),
									name !== "dsh-market" && name !== "dshmarket" && (removingName === name ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "outline",
										size: "sm",
										className: Market_module_css_default.dangerBtn,
										disabled: true,
										children: t("uninstalling")
									}) : removeArmed === name ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "primary",
										size: "sm",
										className: Market_module_css_default.dangerArmed,
										onClick: () => doUninstall(name),
										onMouseLeave: () => setRemoveArmed(null),
										children: t("confirmRemove")
									}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "outline",
										size: "sm",
										className: Market_module_css_default.dangerBtn,
										disabled: removingName !== null || busyUrl !== null || updatingName !== null,
										onClick: () => setRemoveArmed(name),
										children: t("uninstall")
									}))
								]
							}, name);
						})
					}),
					showTop && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						className: Market_module_css_default.top,
						title: t("backTop"),
						onClick: () => {
							const el = bodyRef.current;
							if (el) el.scrollTo({
								top: 0,
								behavior: "smooth"
							});
						},
						children: "↑"
					}),
					confirming !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: true,
						onClose: () => setConfirming(null),
						title: t("confirmTitle") + " " + confirming.name + "?",
						description: confirming.description && (confirming.description[lang] || confirming.description.en) || "",
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "ghost",
							onClick: () => setConfirming(null),
							children: t("cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							onClick: () => doInstall(confirming),
							children: t("confirm")
						})] }),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
								className: Market_module_css_default.cmdDetails,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", {
									className: Market_module_css_default.cmdSummary,
									children: t("cmdDetails")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: Market_module_css_default.cmd,
									children: confirming.install
								})]
							}),
							looksTerminal(confirming, lang) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
								className: Market_module_css_default.warnLine,
								children: ["🖥️ " + t("terminalWarn") + " ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
									className: Market_module_css_default.src,
									href: confirming.url + "#readme",
									target: "_blank",
									rel: "noreferrer",
									children: t("readme")
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: Market_module_css_default.modalNote,
								children: "⚠️ " + t("confirmWarn")
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region src/client/index.ts
		/**
		* dsh-market client: registers a "Market" settings section rendering the
		* plugin market UI, plus the post-install toast in the shell overlay layer.
		* Built by tsdown into the __ModuleLoader__ factory bundle at
		* client/client.js; the only externals are the loader module table's react
		* entries.
		*/
		const NS = "dsh-market";
		const name = "dsh-market";
		const inject = [
			"slots",
			"locale",
			"theme"
		];
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-market: dictionaries");
			const t = ctx.locale.bind(NS);
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "market",
				order: 40,
				label: () => t("nav"),
				locale: NS,
				inject: () => ({ t })
			}, () => (0, react.createElement)(MarketSection, {
				t,
				locale: ctx.locale,
				theme: ctx.theme,
				themeStore: {
					subscribe: (cb) => ctx.on("theme/change", cb),
					getSnapshot: () => ctx.theme.getTheme()
				}
			})));
			const Toast = () => (0, react.createElement)(InstallToast, { t });
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "dsh-market-toast",
				label: () => "dsh-market"
			}, Toast));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map