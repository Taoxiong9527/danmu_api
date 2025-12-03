import { Globals } from './configs/globals.js';
import { jsonResponse } from './utils/http-util.js';
import { log, formatLogMessage } from './utils/log-util.js'
import { getRedisCaches, judgeRedisValid } from "./utils/redis-util.js";
import { cleanupExpiredIPs, findUrlById, getCommentCache, getLocalCaches, judgeLocalCacheValid } from "./utils/cache-util.js";
import { formatDanmuResponse } from "./utils/danmu-util.js";
import { getBangumi, getComment, getCommentByUrl, matchAnime, searchAnime, searchEpisodes } from "./apis/dandan-api.js";

let globals;

async function handleRequest(req, env, deployPlatform, clientIp) {
  // 加载全局变量和环境变量配置
  globals = Globals.init(env, deployPlatform);

  const url = new URL(req.url);
  let path = url.pathname;
  const method = req.method;

  if (deployPlatform === "node") {
    await judgeLocalCacheValid(path, deployPlatform);
  }
  await judgeRedisValid(path);

  log("info", `request url: ${JSON.stringify(url)}`);
  log("info", `request path: ${path}`);
  log("info", `client ip: ${clientIp}`);

  if (deployPlatform === "node" && globals.localCacheValid && path !== "/favicon.ico" && path !== "/robots.txt") {
    await getLocalCaches();
  }
  if (globals.redisValid && path !== "/favicon.ico" && path !== "/robots.txt") {
    await getRedisCaches();
  }

  function handleHomepage(req) {
    log("info", "Accessed homepage with repository information");
    
    // Check if the request accepts HTML (browser request)
    const acceptHeader = req.headers.get('accept') || '';
    const wantsHtml = acceptHeader.includes('text/html');
    
    // Return HTML for browsers, JSON for API clients
    if (wantsHtml) {
      const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LogVar 弹幕 API 服务器</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            padding: 40px;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 30px;
            border-bottom: 2px solid #f0f0f0;
        }
        .header h1 {
            color: #667eea;
            font-size: 2.5rem;
            margin-bottom: 10px;
        }
        .header .version {
            color: #888;
            font-size: 0.9rem;
        }
        .section {
            margin-bottom: 30px;
        }
        .section h2 {
            color: #444;
            font-size: 1.5rem;
            margin-bottom: 15px;
            padding-left: 10px;
            border-left: 4px solid #667eea;
        }
        .section p {
            color: #666;
            margin-bottom: 15px;
            line-height: 1.8;
        }
        .info-box {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 15px 0;
        }
        .info-box pre {
            background: #2d3748;
            color: #e2e8f0;
            padding: 15px;
            border-radius: 6px;
            overflow-x: auto;
            font-size: 0.85rem;
        }
        .links {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
            margin-top: 20px;
        }
        .links a {
            background: #667eea;
            color: white;
            padding: 10px 20px;
            border-radius: 6px;
            text-decoration: none;
            transition: background 0.3s;
        }
        .links a:hover {
            background: #5568d3;
        }
        .notice {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
        }
        .env-info {
            font-size: 0.85rem;
            color: #666;
            margin-top: 10px;
        }
        .env-info strong {
            color: #444;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎬 LogVar 弹幕 API 服务器</h1>
            <p class="version">Version ${globals.VERSION}</p>
        </div>

        <div class="section">
            <h2>📖 项目介绍</h2>
            <p>一个人人都能部署的基于 js 的弹幕 API 服务器，支持爱优腾芒哔人韩巴弹幕直接获取，兼容弹弹play的搜索、详情查询和弹幕获取接口规范，并提供日志记录，支持vercel/netlify/edgeone/cloudflare/docker/claw等部署方式，不用提前下载弹幕，没有nas或小鸡也能一键部署。</p>
        </div>

        <div class="section">
            <h2>⚡ API 端点</h2>
            <div class="info-box">
                <pre>GET  /api/v2/search/anime?keyword=关键词
GET  /api/v2/search/episodes?anime=关键词
POST /api/v2/match
GET  /api/v2/bangumi/:animeId
GET  /api/v2/comment/:commentId?format=json
GET  /api/v2/comment?url=视频URL&format=json
GET  /api/logs</pre>
            </div>
        </div>

        <div class="section">
            <h2>🔧 系统状态</h2>
            <div class="info-box">
                <div class="env-info">
                    <strong>本地缓存:</strong> ${globals.localCacheValid ? '✅ 已启用' : '❌ 未启用'}<br>
                    <strong>Redis缓存:</strong> ${globals.redisValid ? '✅ 已连接' : '❌ 未连接'}<br>
                    <strong>环境变量:</strong> ${Object.keys(globals.accessedEnvVars).length} 个已配置
                </div>
            </div>
        </div>

        <div class="notice">
            <strong>⚠️ 注意事项</strong><br>
            本项目仅为个人爱好开发，代码开源。如有任何侵权行为，请联系本人删除。有问题提issue或私信机器人都ok。
        </div>

        <div class="section">
            <h2>🔗 相关链接</h2>
            <div class="links">
                <a href="https://github.com/huangxd-/danmu_api" target="_blank">📦 GitHub 仓库</a>
                <a href="https://t.me/ddjdd_bot" target="_blank">🤖 Telegram 机器人</a>
                <a href="https://t.me/logvar_danmu_group" target="_blank">👥 互助群组</a>
                <a href="https://t.me/logvar_danmu_channel" target="_blank">📢 更新频道</a>
            </div>
        </div>
    </div>
    <script type="module">
        import { inject } from 'https://cdn.jsdelivr.net/npm/@vercel/analytics@1.6.1/dist/index.mjs';
        inject({ mode: 'auto', debug: false });
    </script>
</body>
</html>`;
      
      return new Response(htmlContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // Return JSON for API clients
    return jsonResponse({
      message: "Welcome to the LogVar Danmu API server",
      version: globals.VERSION,
      envs: {
        ...globals.accessedEnvVars,
        localCacheValid: globals.localCacheValid,
        redisValid: globals.redisValid
      },
      repository: "https://github.com/huangxd-/danmu_api.git",
      description: "一个人人都能部署的基于 js 的弹幕 API 服务器，支持爱优腾芒哔人韩巴弹幕直接获取，兼容弹弹play的搜索、详情查询和弹幕获取接口规范，并提供日志记录，支持vercel/netlify/edgeone/cloudflare/docker/claw等部署方式，不用提前下载弹幕，没有nas或小鸡也能一键部署。",
      notice: "本项目仅为个人爱好开发，代码开源。如有任何侵权行为，请联系本人删除。有问题提issue或私信机器人都ok，TG MSG ROBOT: [https://t.me/ddjdd_bot]; 推荐加互助群咨询，TG GROUP: [https://t.me/logvar_danmu_group]; 关注频道获取最新更新内容，TG CHANNEL: [https://t.me/logvar_danmu_channel]。"
    });
  }

  // GET /
  if (path === "/" && method === "GET") {
    return handleHomepage(req);
  }

  if (path === "/favicon.ico" || path === "/robots.txt" || method === "OPTIONS") {
    return new Response(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, User-Agent"
        }
    });
  }

  // --- 校验 token ---
  const parts = path.split("/").filter(Boolean); // 去掉空段

  // 如果 token 是默认值 87654321
  if (globals.token === "87654321") {
    // 检查第一段是否是已知的 API 路径（不是 token）
    const knownApiPaths = ["api", "v1", "v2", "search", "match", "bangumi", "comment"];

    if (parts.length > 0) {
      // 如果第一段是正确的默认 token
      if (parts[0] === "87654321") {
        // 移除 token，继续处理
        path = "/" + parts.slice(1).join("/");
      } else if (!knownApiPaths.includes(parts[0])) {
        // 第一段不是已知的 API 路径，可能是错误的 token
        // 返回 401
        log("error", `Invalid token in path: ${path}`);
        return jsonResponse(
          { errorCode: 401, success: false, errorMessage: "Unauthorized" },
          401
        );
      }
      // 如果第一段是已知的 API 路径（如 "api"），允许直接访问
    }
  } else {
    // token 不是默认值，必须严格校验
    if (parts.length < 1 || parts[0] !== globals.token) {
      log("error", `Invalid or missing token in path: ${path}`);
      return jsonResponse(
        { errorCode: 401, success: false, errorMessage: "Unauthorized" },
        401
      );
    }
    // 移除 token 部分，剩下的才是真正的路径
    path = "/" + parts.slice(1).join("/");
  }

  log("info", path);

  // 智能处理API路径前缀，确保最终有一个正确的 /api/v2
  if (path !== "/" && path !== "/api/logs") {
      log("info", `[Path Check] Starting path normalization for: "${path}"`);
      const pathBeforeCleanup = path; // 保存清理前的路径检查是否修改
      
      // 1. 清理：应对“用户填写/api/v2”+“客户端添加/api/v2”导致的重复前缀
      while (path.startsWith('/api/v2/api/v2/')) {
          log("info", `[Path Check] Found redundant /api/v2 prefix. Cleaning...`);
          // 从第二个 /api/v2 的位置开始截取，相当于移除第一个
          path = path.substring('/api/v2'.length);
      }
      
      // 打印日志：只有在发生清理时才显示清理后的路径，否则显示“无需清理”
      if (path !== pathBeforeCleanup) {
          log("info", `[Path Check] Path after cleanup: "${path}"`);
      } else {
          log("info", `[Path Check] Path after cleanup: No cleanup needed.`);
      }
      
      // 2. 补全：如果路径缺少前缀（例如请求原始路径为 /search/anime），则补全
      const pathBeforePrefixCheck = path;
      if (!path.startsWith('/api/v2') && path !== '/' && !path.startsWith('/api/logs')) {
          log("info", `[Path Check] Path is missing /api/v2 prefix. Adding...`);
          path = '/api/v2' + path;
      }
        
      // 打印日志：只有在发生添加前缀时才显示添加后的路径，否则显示“无需补全”
      if (path === pathBeforePrefixCheck) {
          log("info", `[Path Check] Prefix Check: No prefix addition needed.`);
      }
      
      log("info", `[Path Check] Final normalized path: "${path}"`);
  }
  
  // GET /
  if (path === "/" && method === "GET") {
    return handleHomepage(req);
  }

  // GET /api/v2/search/anime
  if (path === "/api/v2/search/anime" && method === "GET") {
    return searchAnime(url);
  }

  // GET /api/v2/search/episodes
  if (path === "/api/v2/search/episodes" && method === "GET") {
    return searchEpisodes(url);
  }

  // GET /api/v2/match
  if (path === "/api/v2/match" && method === "POST") {
    return matchAnime(url, req);
  }

  // GET /api/v2/bangumi/:animeId
  if (path.startsWith("/api/v2/bangumi/") && method === "GET") {
    return getBangumi(path);
  }

  // GET /api/v2/comment/:commentId or /api/v2/comment?url=xxx
  if (path.startsWith("/api/v2/comment") && method === "GET") {
    const queryFormat = url.searchParams.get('format');
    const videoUrl = url.searchParams.get('url');

    // ⚠️ 限流设计说明：
    // 1. 先检查缓存，缓存命中时直接返回，不计入限流次数
    // 2. 只有缓存未命中时才执行限流检查和网络请求
    // 3. 这样可以避免频繁访问同一弹幕时被限流，提高用户体验

    // 如果有url参数，则通过URL获取弹幕
    if (videoUrl) {
      // 先检查缓存
      const cachedComments = getCommentCache(videoUrl);
      if (cachedComments !== null) {
        log("info", `[Rate Limit] Cache hit for URL: ${videoUrl}, skipping rate limit check`);
        const responseData = { count: cachedComments.length, comments: cachedComments };
        return formatDanmuResponse(responseData, queryFormat);
      }

      // 缓存未命中，执行限流检查（如果 rateLimitMaxRequests > 0 则启用限流）
      if (globals.rateLimitMaxRequests > 0) {
        const currentTime = Date.now();
        const oneMinute = 60 * 1000;

        // 清理所有过期的 IP 记录
        cleanupExpiredIPs(currentTime);

        // 检查该 IP 地址的历史请求
        if (!globals.requestHistory.has(clientIp)) {
          globals.requestHistory.set(clientIp, []);
        }

        const history = globals.requestHistory.get(clientIp);
        const recentRequests = history.filter(timestamp => currentTime - timestamp <= oneMinute);

        // 如果最近 1 分钟内的请求次数超过限制，返回 429 错误
        if (recentRequests.length >= globals.rateLimitMaxRequests) {
          log("warn", `[Rate Limit] IP ${clientIp} exceeded rate limit (${recentRequests.length}/${globals.rateLimitMaxRequests} requests in 1 minute)`);
          return jsonResponse(
            { errorCode: 429, success: false, errorMessage: "Too many requests, please try again later" },
            429
          );
        }

        // 记录本次请求时间戳
        recentRequests.push(currentTime);
        globals.requestHistory.set(clientIp, recentRequests);
        log("info", `[Rate Limit] IP ${clientIp} request count: ${recentRequests.length}/${globals.rateLimitMaxRequests}`);
      }

      // 通过URL获取弹幕
      return getCommentByUrl(videoUrl, queryFormat);
    }

    // 否则通过commentId获取弹幕
    if (!path.startsWith("/api/v2/comment/")) {
      log("error", "Missing commentId or url parameter");
      return jsonResponse(
        { errorCode: 400, success: false, errorMessage: "Missing commentId or url parameter" },
        400
      );
    }

    const commentId = parseInt(path.split("/").pop());
    let urlForComment = findUrlById(commentId);

    if (urlForComment) {
      // 检查弹幕缓存 - 缓存命中时直接返回，不计入限流
      const cachedComments = getCommentCache(urlForComment);
      if (cachedComments !== null) {
        log("info", `[Rate Limit] Cache hit for URL: ${urlForComment}, skipping rate limit check`);
        const responseData = { count: cachedComments.length, comments: cachedComments };
        return formatDanmuResponse(responseData, queryFormat);
      }
    }

    // 缓存未命中，执行限流检查（如果 rateLimitMaxRequests > 0 则启用限流）
    if (globals.rateLimitMaxRequests > 0) {
      // 获取当前时间戳（单位：毫秒）
      const currentTime = Date.now();
      const oneMinute = 60 * 1000;  // 1分钟 = 60000 毫秒

      // 清理所有过期的 IP 记录
      cleanupExpiredIPs(currentTime);

      // 检查该 IP 地址的历史请求
      if (!globals.requestHistory.has(clientIp)) {
        // 如果该 IP 地址没有请求历史，初始化一个空队列
        globals.requestHistory.set(clientIp, []);
      }

      const history = globals.requestHistory.get(clientIp);

      // 过滤掉已经超出 1 分钟的请求
      const recentRequests = history.filter(timestamp => currentTime - timestamp <= oneMinute);

      // 如果最近的请求数量大于等于配置的限制次数，则限制请求
      if (recentRequests.length >= globals.rateLimitMaxRequests) {
        log("warn", `[Rate Limit] IP ${clientIp} exceeded rate limit (${recentRequests.length}/${globals.rateLimitMaxRequests} requests in 1 minute)`);
        return jsonResponse(
          { errorCode: 429, success: false, errorMessage: "Too many requests, please try again later" },
          429
        );
      }

      // 记录本次请求时间戳
      recentRequests.push(currentTime);
      globals.requestHistory.set(clientIp, recentRequests);
      log("info", `[Rate Limit] IP ${clientIp} request count: ${recentRequests.length}/${globals.rateLimitMaxRequests}`);
    }

    return getComment(path, queryFormat);
  }

  // GET /api/logs
  if (path === "/api/logs" && method === "GET") {
    const logText = globals.logBuffer
      .map(
        (log) =>
          `[${log.timestamp}] ${log.level}: ${formatLogMessage(log.message)}`
      )
      .join("\n");
    return new Response(logText, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  return jsonResponse({ message: "Not found" }, 404);
}



// --- Cloudflare Workers 入口 ---
export default {
  async fetch(request, env, ctx) {
    // 获取客户端的真实 IP
    const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';

    return handleRequest(request, env, "cloudflare", clientIp);
  },
};

// --- Vercel 入口 ---
export async function vercelHandler(req, res) {
  // 从请求头获取真实 IP
  const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';

  const cfReq = new Request(req.url, {
    method: req.method,
    headers: req.headers,
    body:
      req.method === "POST" || req.method === "PUT"
        ? JSON.stringify(req.body)
        : undefined,
  });

  const response = await handleRequest(cfReq, process.env, "vercel", clientIp);

  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  const text = await response.text();
  res.send(text);
}

// --- Netlify 入口 ---
export async function netlifyHandler(event, context) {
  // 获取客户端 IP
  const clientIp = event.headers['x-nf-client-connection-ip'] ||
                   event.headers['x-forwarded-for'] ||
                   context.ip ||
                   'unknown';

  // 构造标准 Request 对象
  const url = event.rawUrl || `https://${event.headers.host}${event.path}`;

  const request = new Request(url, {
    method: event.httpMethod,
    headers: new Headers(event.headers),
    body: event.body ? event.body : undefined,
  });

  // 调用核心处理函数
  const response = await handleRequest(request, process.env, "netlify", clientIp);

  // 转换为 Netlify 响应格式
  const headers = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return {
    statusCode: response.status,
    headers,
    body: await response.text(),
  };
}

// 为了测试导出 handleRequest
export { handleRequest};
