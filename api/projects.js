const apiHandler = require("./[...path].js");

const TABLE_URL = "/rest/v1/project_workspace";
const MAX_BODY_BYTES = 1024 * 1024;

function sendJson(res, status, value) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(value));
}

function configured() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/+$/, ""), key };
}

function normalizeProjects(value) {
  if (!Array.isArray(value) || value.length > 500) {
    throw new Error("Danh sách dự án không hợp lệ.");
  }
  return value.map((project) => {
    if (!project || typeof project !== "object" || Array.isArray(project)) {
      throw new Error("Thông tin dự án không hợp lệ.");
    }
    const { id, name, client, progress, deadline, deadlineISO, status, tasks } = project;
    if (typeof id !== "string" || !id || id.length > 100
      || typeof name !== "string" || !name.trim() || name.length > 70
      || typeof client !== "string" || client.length > 100
      || !Number.isInteger(progress) || progress < 0 || progress > 100
      || typeof deadline !== "string" || deadline.length > 50
      || typeof deadlineISO !== "string" || deadlineISO.length > 10
      || !["running", "completed"].includes(status)
      || !Array.isArray(tasks) || tasks.length > 200) {
      throw new Error("Thông tin dự án không hợp lệ.");
    }
    const normalizedTasks = tasks.map((task) => {
      if (!task || typeof task.text !== "string" || task.text.length > 160 || typeof task.done !== "boolean") {
        throw new Error("Công việc trong dự án không hợp lệ.");
      }
      return { text: task.text, done: task.done };
    });
    return { id, name, client, progress, deadline, deadlineISO, status, tasks: normalizedTasks };
  });
}

async function databaseRequest(config, path, options = {}) {
  let response;
  try {
    response = await fetch(`${config.url}${TABLE_URL}${path}`, {
      ...options,
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
        ...options.headers
      }
    });
  } catch (error) {
    console.error("Không thể kết nối Supabase để đồng bộ dự án:", error);
    throw new Error("Không thể kết nối cơ sở dữ liệu dự án. Vui lòng thử lại.");
  }
  const body = await response.text();
  let result;
  try {
    result = body ? JSON.parse(body) : null;
  } catch (error) {
    console.error("Supabase trả về phản hồi JSON không hợp lệ:", error);
    throw new Error("Cơ sở dữ liệu dự án trả về phản hồi không hợp lệ.");
  }
  if (!response.ok) {
    console.error("Supabase từ chối yêu cầu đồng bộ dự án:", response.status, result);
    throw new Error("Không thể lưu hoặc tải dự án từ cơ sở dữ liệu.");
  }
  return result;
}

async function getWorkspace(config) {
  const rows = await databaseRequest(config, "?id=eq.shared&select=projects,revision,updated_at", {
    headers: { Accept: "application/json" }
  });
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function vercelProjectsHandler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET" && req.method !== "POST" && req.method !== "PUT") {
    res.setHeader("Allow", "GET, POST, PUT");
    return sendJson(res, 405, { error: "Phương thức yêu cầu không được hỗ trợ." });
  }
  const config = configured();
  if (!config) {
    return sendJson(res, 503, { error: "Chưa cấu hình cơ sở dữ liệu Supabase trên Vercel." });
  }
  let session;
  try {
    session = apiHandler.getAuthenticatedSession(req);
  } catch (error) {
    console.error("Không thể xác thực phiên 123HOST để đồng bộ dự án:", error);
    return sendJson(res, 500, { error: "Máy chủ chưa cấu hình xác thực 123HOST." });
  }
  if (!session) {
    return sendJson(res, 401, { error: "Hãy đăng nhập tài khoản 123HOST trước khi đồng bộ dự án." });
  }

  let payload = null;
  if (req.method !== "GET") {
    const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
    if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
      return sendJson(res, 413, { error: "Dữ liệu dự án vượt quá giới hạn cho phép." });
    }
    try {
      payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    } catch (error) {
      return sendJson(res, 400, { error: "Nội dung JSON không hợp lệ." });
    }
  }

  if (req.method === "GET") {
    try {
      const workspace = await getWorkspace(config);
      return sendJson(res, 200, workspace
        ? { projects: normalizeProjects(workspace.projects), revision: workspace.revision, updatedAt: workspace.updated_at }
        : { projects: null, revision: 0, updatedAt: null });
    } catch (error) {
      console.error("Không thể tải dự án dùng chung:", error);
      return sendJson(res, 502, { error: error.message || "Không thể tải dự án lúc này." });
    }
  }

  let projects;
  try {
    projects = normalizeProjects(payload.projects);
  } catch (error) {
    return sendJson(res, 400, { error: error.message || "Thông tin dự án không hợp lệ." });
  }

  try {
    if (req.method === "POST") {
      await databaseRequest(config, "?on_conflict=id", {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify({ id: "shared", projects, revision: 1 })
      });
      const workspace = await getWorkspace(config);
      if (!workspace) throw new Error("Không thể khởi tạo không gian dự án dùng chung.");
      return sendJson(res, 200, {
        projects: normalizeProjects(workspace.projects),
        revision: workspace.revision,
        updatedAt: workspace.updated_at
      });
    }

    const revision = Number(payload.revision);
    if (!Number.isSafeInteger(revision) || revision < 1) {
      return sendJson(res, 400, { error: "Phiên bản dữ liệu dự án không hợp lệ." });
    }
    const updated = await databaseRequest(config, `?id=eq.shared&revision=eq.${revision}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ projects, revision: revision + 1, updated_at: new Date().toISOString() })
    });
    if (Array.isArray(updated) && updated.length) {
      return sendJson(res, 200, {
        projects: normalizeProjects(updated[0].projects),
        revision: updated[0].revision,
        updatedAt: updated[0].updated_at
      });
    }
    const latest = await getWorkspace(config);
    return sendJson(res, 409, {
      error: "Dự án vừa được cập nhật trên thiết bị khác. Dữ liệu mới nhất đã được tải lại; hãy thực hiện lại thay đổi.",
      projects: latest ? normalizeProjects(latest.projects) : null,
      revision: latest?.revision || 0,
      updatedAt: latest?.updated_at || null
    });
  } catch (error) {
    console.error("Đồng bộ dự án dùng chung thất bại:", error);
    return sendJson(res, 502, { error: error.message || "Không thể đồng bộ dự án lúc này." });
  }
}

module.exports = vercelProjectsHandler;
