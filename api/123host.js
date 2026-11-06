const handler = require("./[...path].js");

module.exports = async function vercel123HostHandler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host || "localhost"}`);
  const path = url.searchParams.get("path");
  if (!path || path.split("/").some((part) => !part || part === "." || part === "..")) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.end(JSON.stringify({ error: "Đường dẫn API 123HOST không hợp lệ." }));
  }

  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  url.pathname = `/api/123host/${encodedPath}`;
  url.search = "";
  req.url = `${url.pathname}${url.search}`;
  return handler(req, res);
};
