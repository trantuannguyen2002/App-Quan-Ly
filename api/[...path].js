const { createCipheriv, createDecipheriv, createHash, randomBytes } = require("node:crypto");

const API_BASE = "https://client.123host.vn/api";
const COOKIE_NAME = "devhq_session";
const SESSION_MAX_AGE = 8 * 60 * 60;

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function getEncryptionKey() {
  const secret = process.env.DEVHQ_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new ApiError(500, "MÃ¡y chá»§ chÆ°a cáº¥u hÃ¬nh DEVHQ_SESSION_SECRET (cáº§n Ã­t nháº¥t 32 kÃ½ tá»±).");
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

function encryptSession(session, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(session), "utf8"),
    cipher.final()
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

function decryptSession(value, key) {
  if (!value) return null;
  try {
    const data = Buffer.from(value, "base64url");
    if (data.length <= 28) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, data.subarray(0, 12));
    decipher.setAuthTag(data.subarray(12, 28));
    const session = JSON.parse(Buffer.concat([
      decipher.update(data.subarray(28)),
      decipher.final()
    ]).toString("utf8"));
    return session && (session.token || session.authType === "Basic") ? session : null;
  } catch {
    return null;
  }
}

function getCookie(req, name) {
  const cookies = String(req.headers.cookie || "").split(";");
  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");
    if (separator < 0 || cookie.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(cookie.slice(separator + 1).trim());
    } catch {
      return "";
    }
  }
  return "";
}

function setSessionCookie(res, session, key) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const value = encodeURIComponent(encryptSession(session, key));
  if (Buffer.byteLength(value) > 3800) {
    throw new ApiError(502, "PhiÃªn Ä‘Äƒng nháº­p 123HOST vÆ°á»£t quÃ¡ giá»›i háº¡n cookie cá»§a mÃ¡y chá»§.");
  }
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE}${secure}`);
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(body ?? {}));
}

async function readJsonBody(req) {
  if (req.body !== undefined) {
    if (typeof req.body === "string") {
      try {
        return JSON.parse(req.body || "{}");
      } catch {
        throw new ApiError(400, "JSON trong yÃªu cáº§u khÃ´ng há»£p lá»‡.");
      }
    }
    return req.body || {};
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "JSON trong yÃªu cáº§u khÃ´ng há»£p lá»‡.");
  }
}

function getProviderError(status) {
  if (status === 429) return "123HOST Ä‘ang giá»›i háº¡n yÃªu cáº§u Ä‘Äƒng nháº­p (HTTP 429). Vui lÃ²ng Ä‘á»£i rá»“i thá»­ láº¡i.";
  if (status === 401 || status === 403) return "123HOST tá»« chá»‘i yÃªu cáº§u. HÃ£y kiá»ƒm tra thÃ´ng tin Ä‘Äƒng nháº­p vÃ  quyá»n API cá»§a tÃ i khoáº£n.";
  if (status >= 500) return `MÃ¡y chá»§ 123HOST Ä‘ang gáº·p sá»± cá»‘ (HTTP ${status}). Vui lÃ²ng thá»­ láº¡i sau.`;
  return `YÃªu cáº§u tá»›i 123HOST tháº¥t báº¡i (HTTP ${status}).`;
}

async function providerFetch(path, { method = "GET", headers = {}, body } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(30000)
    });
  } catch {
    throw new ApiError(502, "KhÃ´ng káº¿t ná»‘i Ä‘Æ°á»£c 123HOST. Vui lÃ²ng kiá»ƒm tra máº¡ng rá»“i thá»­ láº¡i.");
  }

  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new ApiError(502, "123HOST tráº£ vá» dá»¯ liá»‡u khÃ´ng há»£p lá»‡.");
    }
  }
  if (!response.ok) throw new ApiError(response.status, getProviderError(response.status));
  return data;
}

function basicHeader(session) {
  return `Basic ${Buffer.from(`${session.username}:${session.password}`, "utf8").toString("base64")}`;
}

async function providerRequest(session, path, { method = "GET", query = {}, body } = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) search.set(key, value.join(","));
    else search.set(key, String(value));
  }
  const url = `${path}${search.size ? `?${search}` : ""}`;
  const headers = {
    Authorization: session.authType === "Basic" ? basicHeader(session) : `Bearer ${session.token}`
  };
  let payload;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  try {
    return await providerFetch(url, { method, headers, body: payload });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || !session.refresh || session.authType === "Basic") {
      throw error;
    }
  }

  try {
    const refreshed = await providerFetch("/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh })
    });
    if (!refreshed.token) throw new Error("Missing token");
    session.token = String(refreshed.token);
    if (refreshed.refresh) session.refresh = String(refreshed.refresh);
  } catch {
    throw new ApiError(401, "PhiÃªn 123HOST Ä‘Ã£ háº¿t háº¡n. Vui lÃ²ng Ä‘Äƒng nháº­p láº¡i.");
  }
  headers.Authorization = `Bearer ${session.token}`;
  return providerFetch(url, { method, headers, body: payload });
}

function isValidNameserver(value) {
  return /^(?=.{1,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(\.([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?))+$/u.test(value);
}

async function handleLogin(req, res, key) {
  if (req.method !== "POST") throw new ApiError(405, "PhÆ°Æ¡ng thá»©c khÃ´ng Ä‘Æ°á»£c há»— trá»£.");
  const credentials = await readJsonBody(req);
  const username = String(credentials.username || "").trim();
  const password = String(credentials.password || "");
  if (!username || !password) throw new ApiError(400, "Nháº­p email vÃ  máº­t kháº©u tÃ i khoáº£n 123HOST.");

  let auth;
  try {
    auth = await providerFetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 429) throw error;
    const session = { authType: "Basic", username, password, client: { email: username } };
    try {
      const details = await providerFetch("/details", {
        headers: { Authorization: basicHeader(session) }
      });
      session.client = details.client || session.client;
      setSessionCookie(res, session, key);
      return { authenticated: true, authType: "Basic" };
    } catch (basicError) {
      if (basicError instanceof ApiError && (basicError.status === 401 || basicError.status === 403)) {
        throw new ApiError(basicError.status, "123HOST Ä‘ang giá»›i háº¡n Ä‘Äƒng nháº­p JWT; xÃ¡c thá»±c Basic dá»± phÃ²ng cÅ©ng bá»‹ tá»« chá»‘i. Kiá»ƒm tra email, máº­t kháº©u vÃ  quyá»n API Basic trong tÃ i khoáº£n.");
      }
      throw basicError;
    }
  }

  if (!auth || !auth.token) throw new ApiError(502, "123HOST khÃ´ng tráº£ vá» mÃ£ xÃ¡c thá»±c. HÃ£y kiá»ƒm tra tÃ i liá»‡u API hoáº·c liÃªn há»‡ nhÃ  cung cáº¥p.");
  setSessionCookie(res, {
    authType: "Bearer",
    token: String(auth.token),
    refresh: auth.refresh ? String(auth.refresh) : null,
    client: { email: username }
  }, key);
  return { authenticated: true };
}

async function handleProviderRoute(req, res, key, session, path) {
  const method = req.method;
  const fixedRoutes = {
    "/api/123host/details": ["/details", ["GET"]],
    "/api/123host/domains": ["/domain", ["GET"]],
    "/api/123host/services": ["/service", ["GET"]],
    "/api/123host/invoices": ["/invoice", ["GET"]],
    "/api/123host/balance": ["/balance", ["GET"]],
    "/api/123host/payments": ["/payment", ["GET"]],
    "/api/123host/notifications": ["/notifications/new", ["GET"]]
  };

  if (Object.hasOwn(fixedRoutes, path)) {
    const [providerPath, methods] = fixedRoutes[path];
    if (!methods.includes(method)) throw new ApiError(405, "PhÆ°Æ¡ng thá»©c khÃ´ng Ä‘Æ°á»£c há»— trá»£.");
    const previousSession = JSON.stringify(session);
    const data = await providerRequest(session, providerPath);
    if (path === "/api/123host/details") session.client = data.client || session.client;
    if (JSON.stringify(session) !== previousSession) setSessionCookie(res, session, key);
    return data;
  }

  let match = path.match(/^\/api\/123host\/invoices\/(\d+)$/);
  if (match) {
    if (method !== "GET") throw new ApiError(405, "PhÆ°Æ¡ng thá»©c khÃ´ng Ä‘Æ°á»£c há»— trá»£.");
    const data = await providerRequest(session, `/invoice/${match[1]}`);
    setSessionCookie(res, session, key);
    return data;
  }

  match = path.match(/^\/api\/123host\/notifications\/(\d+)\/ack$/);
  if (match) {
    if (method !== "PUT") throw new ApiError(405, "PhÆ°Æ¡ng thá»©c khÃ´ng Ä‘Æ°á»£c há»— trá»£.");
    const data = await providerRequest(session, `/notifications/${match[1]}/ack`, { method });
    setSessionCookie(res, session, key);
    return data;
  }

  match = path.match(/^\/api\/123host\/domains\/(\d+)\/records\/types$/);
  if (match) {
    if (method !== "GET") throw new ApiError(405, "PhÆ°Æ¡ng thá»©c khÃ´ng Ä‘Æ°á»£c há»— trá»£.");
    const data = await providerRequest(session, `/domain/${match[1]}/dns/types`);
    setSessionCookie(res, session, key);
    return data;
  }

  match = path.match(/^\/api\/123host\/domains\/(\d+)(?:\/(nameservers|records|renew)(?:\/(\d+))?)?$/);
  if (!match) throw new ApiError(404, "KhÃ´ng tÃ¬m tháº¥y API nÃ y.");
  const [, domainId, subroute, recordId] = match;
  let data;

  if (!subroute && method === "GET") {
    data = await providerRequest(session, `/domain/${domainId}`);
  } else if (subroute === "nameservers" && method === "GET") {
    data = await providerRequest(session, `/domain/${domainId}/ns`);
  } else if (subroute === "nameservers" && method === "PUT") {
    const body = await readJsonBody(req);
    if (!Array.isArray(body.nameservers) || body.nameservers.length < 2 || body.nameservers.length > 4) {
      throw new ApiError(400, "Nháº­p tá»« 2 Ä‘áº¿n 4 mÃ¡y chá»§ tÃªn miá»n.");
    }
    const nameservers = body.nameservers.map((value) => String(value).trim());
    if (nameservers.some((value) => !isValidNameserver(value))) {
      throw new ApiError(400, "Má»™t hoáº·c nhiá»u mÃ¡y chá»§ tÃªn miá»n khÃ´ng há»£p lá»‡.");
    }
    data = await providerRequest(session, `/domain/${domainId}/ns`, { method, query: { nameservers } });
  } else if (subroute === "records" && method === "GET" && !recordId) {
    data = await providerRequest(session, `/domain/${domainId}/dns`);
  } else if (subroute === "records" && (method === "POST" || method === "PUT")) {
    const body = await readJsonBody(req);
    const name = String(body.name || "").trim();
    const type = String(body.type || "").toUpperCase();
    const content = String(body.content || "").trim();
    const priority = Number(body.priority);
    if (!name || name.length > 253 || !content || content.length > 2048) {
      throw new ApiError(400, "Nháº­p tÃªn vÃ  ná»™i dung báº£n ghi DNS há»£p lá»‡.");
    }
    if (!["A", "CNAME", "URL", "FRAME", "MX", "MXE", "TXT"].includes(type)) {
      throw new ApiError(400, "Loáº¡i báº£n ghi DNS khÃ´ng Ä‘Æ°á»£c há»— trá»£.");
    }
    if (!Number.isInteger(priority) || priority < 0 || priority > 65535) {
      throw new ApiError(400, "Äá»™ Æ°u tiÃªn pháº£i náº±m trong khoáº£ng 0 Ä‘áº¿n 65535.");
    }
    if ((method === "PUT" && !recordId) || (method === "POST" && recordId)) {
      throw new ApiError(404, "KhÃ´ng tÃ¬m tháº¥y báº£n ghi DNS cáº§n cáº­p nháº­t.");
    }
    const query = { name, type, content, priority };
    data = await providerRequest(session, `/domain/${domainId}/dns${recordId ? `/@${recordId}` : ""}`, { method, query });
  } else if (subroute === "records" && method === "DELETE" && recordId) {
    data = await providerRequest(session, `/domain/${domainId}/dns/@${recordId}`, { method });
  } else if (subroute === "renew" && method === "POST") {
    const body = await readJsonBody(req);
    const years = Number(body.years);
    const paymentMethod = Number(body.paymentMethod);
    if (!Number.isInteger(years) || years < 1 || years > 10) {
      throw new ApiError(400, "Thá»i háº¡n gia háº¡n pháº£i tá»« 1 Ä‘áº¿n 10 nÄƒm.");
    }
    if (!Number.isInteger(paymentMethod) || paymentMethod < 1) {
      throw new ApiError(400, "Chá»n má»™t phÆ°Æ¡ng thá»©c thanh toÃ¡n há»£p lá»‡.");
    }
    data = await providerRequest(session, `/domain/${domainId}/renew`, {
      method,
      query: { years, pay_method: paymentMethod }
    });
  } else {
    throw new ApiError(405, "PhÆ°Æ¡ng thá»©c hoáº·c Ä‘Æ°á»ng dáº«n API khÃ´ng Ä‘Æ°á»£c há»— trá»£.");
  }

  setSessionCookie(res, session, key);
  return data;
}

module.exports = async function handler(req, res) {
  try {
    const key = getEncryptionKey();
    const url = new URL(req.url, `https://${req.headers.host || "localhost"}`);
    const path = url.pathname;

    if (path === "/api/login") {
      return sendJson(res, 200, await handleLogin(req, res, key));
    }
    if (path === "/api/logout") {
      if (req.method !== "POST") throw new ApiError(405, "PhÆ°Æ¡ng thá»©c khÃ´ng Ä‘Æ°á»£c há»— trá»£.");
      const session = decryptSession(getCookie(req, COOKIE_NAME), key);
      let remoteLogoutConfirmed = true;
      if (session?.token) {
        try {
          await providerRequest(session, "/logout", { method: "POST" });
        } catch {
          remoteLogoutConfirmed = false;
        }
      }
      clearSessionCookie(res);
      return sendJson(res, 200, { authenticated: false, remoteLogoutConfirmed });
    }
    if (path === "/api/session") {
      if (req.method !== "GET") throw new ApiError(405, "PhÆ°Æ¡ng thá»©c khÃ´ng Ä‘Æ°á»£c há»— trá»£.");
      const session = decryptSession(getCookie(req, COOKIE_NAME), key);
      return sendJson(res, 200, { authenticated: Boolean(session), client: session?.client || null });
    }

    const session = decryptSession(getCookie(req, COOKIE_NAME), key);
    if (!session) throw new ApiError(401, "HÃ£y káº¿t ná»‘i tÃ i khoáº£n 123HOST trÆ°á»›c.");
    return sendJson(res, 200, await handleProviderRoute(req, res, key, session, path));
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof ApiError ? error.message : "MÃ¡y chá»§ khÃ´ng thá»ƒ xá»­ lÃ½ yÃªu cáº§u. Vui lÃ²ng kiá»ƒm tra cáº¥u hÃ¬nh Vercel.";
    return sendJson(res, status, { error: message });
  }
};
