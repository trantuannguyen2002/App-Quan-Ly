(() => {
      const STORAGE_KEY = "devhq-app-data-v1";
      const initialState = {
        projects: [
          { id: "alpha", name: "Project Alpha", client: "Nền tảng thương mại điện tử", progress: 80, deadline: "30 Th11, 2026", deadlineISO: "2026-11-30", status: "running", tasks: [{ text: "Hoàn thiện giao diện trang chủ", done: true }, { text: "Thiết kế trang sản phẩm", done: true }, { text: "Tối ưu giao diện trên điện thoại", done: true }, { text: "Kiểm thử trải nghiệm người dùng", done: true }, { text: "Kết nối thanh toán trực tuyến", done: false }] },
          { id: "beta", name: "Project Beta", client: "Thiết kế website thương hiệu", progress: 60, deadline: "12 Th12, 2026", deadlineISO: "2026-12-12", status: "running", tasks: [{ text: "Chốt thiết kế trang giới thiệu", done: true }, { text: "Xây dựng trang chủ", done: true }, { text: "Tối ưu hình ảnh", done: true }, { text: "Kiểm tra trên thiết bị di động", done: false }, { text: "Bàn giao website", done: false }] },
          { id: "gamma", name: "Cổng thông tin UVA", client: "Cổng thông tin quản trị", progress: 100, deadline: "20 Th10, 2026", deadlineISO: "2026-10-20", status: "completed", tasks: [{ text: "Bàn giao sản phẩm cho khách hàng", done: true }] }
        ],
        domains: [
          { id: "myportfolio", name: "myportfolio.com", status: "warning", days: 19, expiry: "14 Th11, 2026", dns: "ns1.devhq.vn", owner: "Sarah Anderson" },
          { id: "admin", name: "admin.vn", status: "warning", days: 12, expiry: "07 Th11, 2026", dns: "ns2.devhq.vn", owner: "Đội ngũ DevHQ" },
          { id: "daklak", name: "daklak.info.vn", status: "active", days: 210, expiry: "02 Th06, 2027", dns: "ns1.devhq.vn", owner: "Khách hàng" },
          { id: "taxitour", name: "taxitour.com.vn", status: "active", days: 328, expiry: "28 Th09, 2027", dns: "ns2.devhq.vn", owner: "Khách hàng" },
          { id: "uva", name: "uva.vn", status: "active", days: 275, expiry: "02 Th08, 2027", dns: "ns1.devhq.vn", owner: "Đội ngũ DevHQ" }
        ],
        sites: [
          { name: "artisanbakery.com", account: "Green Account", used: 14, limit: 20, server: "VN-HCM-01" },
          { name: "fitnesscoach.io", account: "Orange Account", used: 8, limit: 20, server: "VN-HCM-02" },
          { name: "nongsanxanh.vn", account: "Green Account", used: 11, limit: 25, server: "VN-HN-01" }
        ],
        accounts: [
          { name: "Green Account", ip: "103.97.126.81", used: 1.2, limit: 2, color: "cyan" },
          { name: "Orange Account", ip: "103.97.126.81", used: 0.9, limit: 2, color: "orange" }
        ],
        vps: [{ id: "vps-uva", name: "VPS-uva", cpu: 45, ram: 2.1, limit: 4, ip: "103.97.126.81" }],
        transfers: [],
        notifications: true,
        autoRenew: false
      };
      const screenNames = { home: "Trang Chủ", projects: "Dự Án", domains: "Tên Miền & DNS", hosting: "Hosting & VPS", settings: "Cài Đặt" };
      const routeHashes = { home: "trang-chu", projects: "du-an", domains: "ten-mien", hosting: "hosting", settings: "cai-dat" };
      const appView = document.querySelector("#app-view");
      const modalRoot = document.querySelector("#modal-root");
      const toast = document.querySelector("#toast");
      const apiState = {
        authenticated: false,
        client: null,
        domains: [],
        services: [],
        servicesLoaded: false,
        invoices: [],
        invoicesLoaded: false,
        balanceLoaded: false,
        dnsRecordTypes: [],
        payments: {},
        paymentsLoaded: false,
        balance: null,
        notifications: [],
        notificationsLoaded: false,
        notificationsError: "",
        loading: false,
        domainError: "",
        domainSyncing: false,
        domainsLastSyncedAt: null,
        dnsRecordTypesPromise: null,
        dnsRecordTypesError: "",
        dnsRecords: {}
      };
      const documentedDnsRecordTypes = ["A", "CNAME", "URL", "FRAME", "MX", "MXE", "TXT"];
      let state = loadState();
      let currentScreen = "home";
      let projectFilter = "all";
      let domainQuery = "";
      let domainFilter = "all";
      let domainPage = 1;
      let apiLoadPromise = null;
      let domainLoadPromise = null;
      let hostingLoadPromise = null;
      let notificationsLoadPromise = null;
      let toastTimer;

      function loadState() {
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (!saved) return structuredClone(initialState);
          const parsed = JSON.parse(saved);
          return {
            ...structuredClone(initialState),
            ...parsed,
            projects: Array.isArray(parsed.projects) ? parsed.projects : structuredClone(initialState.projects),
            domains: Array.isArray(parsed.domains) ? parsed.domains : structuredClone(initialState.domains),
            sites: Array.isArray(parsed.sites) ? parsed.sites : structuredClone(initialState.sites),
            accounts: Array.isArray(parsed.accounts) ? parsed.accounts : structuredClone(initialState.accounts),
            vps: Array.isArray(parsed.vps) ? parsed.vps : structuredClone(initialState.vps),
            transfers: Array.isArray(parsed.transfers) ? parsed.transfers : []
          };
        } catch (error) {
          console.error("Không thể đọc dữ liệu DevHQ đã lưu:", error);
          window.setTimeout(() => notify("Dữ liệu đã lưu không đọc được. Ứng dụng đang dùng dữ liệu mẫu."), 0);
          return structuredClone(initialState);
        }
      }

      function saveState() {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
          return true;
        } catch (error) {
          console.error("Không thể lưu dữ liệu DevHQ:", error);
          notify("Không thể lưu dữ liệu trên trình duyệt này. Hãy kiểm tra dung lượng lưu trữ.");
          return false;
        }
      }

      function esc(value) {
        return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
      }

      function formatDate(value) {
        if (!value) return "";
        const text = String(value).trim();
        const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
        if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
        const numeric = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (numeric) return `${numeric[1].padStart(2, "0")}/${numeric[2].padStart(2, "0")}/${numeric[3]}`;
        const vietnamese = text.match(/^(\d{1,2})\s+Th(\d{1,2}),?\s*(\d{4})$/i);
        if (vietnamese) return `${vietnamese[1].padStart(2, "0")}/${vietnamese[2].padStart(2, "0")}/${vietnamese[3]}`;
        return text;
      }

      function formatMoney(value, currency = "") {
        const text = String(value ?? "0").trim();
        const amount = Number(text.replace(/,/g, ""));
        if (!text || !Number.isFinite(amount)) return `${text || "0"}${currency ? ` ${currency}` : ""}`;
        const isVnd = String(currency).trim().toUpperCase() === "VND";
        const formatted = new Intl.NumberFormat("vi-VN", {
          minimumFractionDigits: isVnd ? 0 : 2,
          maximumFractionDigits: isVnd ? 0 : 2
        }).format(amount);
        return `${formatted}${currency ? ` ${currency}` : ""}`;
      }

      function getTimeGreeting() {
        const hour = new Date().getHours();
        return hour < 12 ? "Chào buổi sáng" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";
      }

      function updateHomeGreeting() {
        const greeting = document.querySelector("[data-home-greeting]");
        if (greeting) greeting.textContent = `${getTimeGreeting()}, ${getAccountName()}!`;
      }

      function icon(name, size = 17) {
        return `<svg width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
      }

      function heading(title, subtitle, action = "") {
        const today = new Date();
        const date = formatDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`);
        return `<div class="page-heading"><div><p class="eyebrow">KHÔNG GIAN LÀM VIỆC · DEVHQ</p><h1>${title}</h1><p class="page-subtitle">${subtitle}</p></div>${action || `<div class="date-chip">${icon("calendar", 14)}${date}</div>`}</div>`;
      }

      function section(title, description = "", trailing = "") {
        return `<div class="panel-heading"><div><h2>${title}</h2>${description ? `<p class="panel-description">${description}</p>` : ""}</div>${trailing}</div>`;
      }

      function progress(label, value, suffix = "%") {
        const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
        return `<div class="progress-block"><div class="progress-heading"><span>${label}</span><strong>${esc(value)}${suffix}</strong></div><div class="progress-track" role="progressbar" aria-label="${esc(label)}" aria-valuenow="${safeValue}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" style="width:${safeValue}%"></div></div></div>`;
      }

      function meter(label, displayValue, percentage) {
        const safeValue = Math.max(0, Math.min(100, Number(percentage) || 0));
        return `<div class="progress-block"><div class="progress-heading"><span>${label}</span><strong>${esc(displayValue)}</strong></div><div class="progress-track" role="progressbar" aria-label="${esc(label)}" aria-valuenow="${safeValue}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" style="width:${safeValue}%"></div></div></div>`;
      }

      function projectCard(project, expanded = false) {
        const statusLabel = project.status === "completed" ? "Hoàn thành" : "Đang chạy";
        const statusClass = project.status === "completed" ? "green" : "";
        const completedTasks = project.tasks.filter((task) => task.done).length;
        return `<article class="project-card">
          <div class="card-heading"><div><div class="card-title">${esc(project.name)}</div><div class="card-caption">${esc(project.client)}</div></div><span class="status-pill ${statusClass}">${statusLabel}</span></div>
          ${progress("Tiến độ", project.progress)}
          ${expanded ? `<div class="project-detail"><div class="project-task-heading"><div class="card-caption">Danh sách công việc · ${completedTasks}/${project.tasks.length} hoàn thành</div><button class="link-button" type="button" data-action="edit-project-tasks" data-id="${esc(project.id)}">Sửa danh sách</button></div><div class="task-list">${project.tasks.map((task, index) => `<label class="task-row ${task.done ? "done" : ""}"><input type="checkbox" data-action="task-toggle" data-id="${esc(project.id)}" data-index="${index}" ${task.done ? "checked" : ""}><span>${esc(task.text)}</span></label>`).join("") || `<div class="card-caption">Chưa có công việc nào.</div>`}</div><div class="project-footer"><span class="deadline">Hạn hoàn thành · ${esc(formatDate(project.deadlineISO || project.deadline) || "Chưa đặt")}</span><div class="project-actions"><button class="button small" type="button" data-action="edit-project" data-id="${esc(project.id)}">Chỉnh sửa</button><button class="button small" type="button" data-action="toggle-project" data-id="${esc(project.id)}">${project.status === "completed" ? "Mở lại dự án" : "Đánh dấu hoàn tất"}</button><button class="button danger small" type="button" data-action="delete-project" data-id="${esc(project.id)}">Xóa</button></div></div></div>` : `<div class="project-footer"><span class="deadline">Hạn hoàn thành · ${esc(formatDate(project.deadlineISO || project.deadline) || "Chưa đặt")}</span><div class="project-actions"><button class="button small" type="button" data-action="edit-project" data-id="${esc(project.id)}">Chỉnh sửa</button><button class="link-button" type="button" data-action="expand-project" data-id="${esc(project.id)}">Công việc →</button><button class="button danger small" type="button" data-action="delete-project" data-id="${esc(project.id)}">Xóa</button></div></div>`}
        </article>`;
      }

      function domainCard(domain) {
        const expiry = getDomainExpiry(domain);
        const warning = expiry.category !== "active";
        const statusText = expiry.category === "expired" ? "Đã hết hạn" : warning ? "Sắp hết hạn" : "Hoạt động";
        const daysText = expiry.days === null
          ? domain.expiry === "Chưa thiết lập" ? "Chưa thiết lập ngày hết hạn" : `Hạn ${esc(expiry.date)}`
          : expiry.days < 0 ? `Quá hạn ${Math.abs(expiry.days)} ngày · Hết hạn ${esc(expiry.date)}`
          : expiry.days === 0 ? `Hết hạn hôm nay · ${esc(expiry.date)}`
          : `Còn ${expiry.days} ngày · Hết hạn ${esc(expiry.date)}`;
        return `<article class="domain-card ${expiry.category === "expired" ? "domain-expired" : warning ? "domain-warning" : ""}">
          <div class="card-heading"><div><div class="card-title">${esc(domain.name)}</div><div class="card-caption">${esc(domain.owner)} · ${esc(domain.dns)}</div></div><span class="status-pill ${expiry.category === "expired" ? "red" : warning ? "orange" : "green"}">${statusText}</span></div>
          <div class="warning-caption" style="${warning ? "" : "color:#8392aa"}">${daysText}</div>
          <div class="domain-links"><button class="domain-link" type="button" data-action="domain-dns" data-id="${esc(domain.id)}">Cấu hình DNS</button><button class="domain-link" type="button" data-action="domain-transfer" data-id="${esc(domain.id)}">Chuyển tên miền</button>${warning ? `<button class="button danger small" type="button" data-action="renew-domain" data-id="${esc(domain.id)}">Gia Hạn</button>` : ""}</div>
        </article>`;
      }

      function liveDomainCard(domain) {
        const expiry = getDomainExpiry(domain);
        const warning = expiry.category !== "active";
        const id = String(domain.id);
        const statusClass = expiry.category === "expired" ? "red" : warning ? "orange" : "green";
        const statusText = expiry.category === "expired" ? "Đã hết hạn" : expiry.category === "expiring" ? "Sắp hết hạn" : esc(domain.status || "Hoạt động");
        const expiryText = expiry.days === null ? `Hạn ${esc(expiry.date)}` : expiry.days < 0 ? `Quá hạn ${Math.abs(expiry.days)} ngày · ${esc(expiry.date)}` : expiry.days === 0 ? `Hết hạn hôm nay · ${esc(expiry.date)}` : `Còn ${expiry.days} ngày · Hết hạn ${esc(expiry.date)}`;
        return `<article class="domain-card ${expiry.category === "expired" ? "domain-expired" : warning ? "domain-warning" : ""}">
          <div class="card-heading"><div><div class="card-title">${esc(domain.name || "Tên miền")}</div><div class="card-caption">Mã dịch vụ · ${esc(id)}</div></div><span class="status-pill ${statusClass}">${statusText}</span></div>
          <div class="warning-caption" style="${warning ? "" : "color:#8392aa"}">${expiryText}</div>
          <div class="domain-links"><button class="domain-link" type="button" data-action="api-nameservers" data-id="${esc(id)}">Máy chủ tên miền</button><button class="domain-link" type="button" data-action="api-records" data-id="${esc(id)}" data-name="${esc(domain.name || "")}">Bản ghi DNS</button>${warning ? `<button class="button danger small" type="button" data-action="api-renew" data-id="${esc(id)}" data-name="${esc(domain.name || "")}">Gia Hạn</button>` : ""}</div>
        </article>`;
      }

      function getDomainExpiry(domain) {
        const status = String(domain.status || "").trim().toLowerCase();
        const rawDays = domain.daytoexpire ?? domain.days;
        let days = rawDays !== null && rawDays !== undefined && String(rawDays).trim() !== "" ? Number(rawDays) : null;
        const rawDate = String(domain.expires || domain.next_due || domain.expiry || "").trim();
        let date = formatDate(rawDate) || "Chưa có thông tin";
        let expiryUtc = null;
        if (rawDate === "Chưa thiết lập") days = null;
        let dateParts = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
        if (dateParts) {
          dateParts = [dateParts[0], dateParts[1], dateParts[2], dateParts[3]];
        } else {
          const numericDate = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          const vietnameseDate = rawDate.match(/^(\d{1,2})\s+Th(\d{1,2}),?\s*(\d{4})$/i);
          const parsed = numericDate || vietnameseDate;
          if (parsed) dateParts = [parsed[0], parsed[3], parsed[2], parsed[1]];
        }
        if (dateParts) {
          const year = Number(dateParts[1]);
          const month = Number(dateParts[2]);
          const day = Number(dateParts[3]);
          const parsedUtc = Date.UTC(year, month - 1, day);
          const validDate = new Date(parsedUtc);
          if (validDate.getUTCFullYear() === year && validDate.getUTCMonth() === month - 1 && validDate.getUTCDate() === day) {
            expiryUtc = parsedUtc;
          }
        }
        const today = new Date();
        const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
        if (expiryUtc !== null) days = Math.round((expiryUtc - todayUtc) / 86400000);
        else if (days !== null && Number.isFinite(days)) expiryUtc = todayUtc + Math.round(days) * 86400000;
        if (/expired|terminated|cancelled/.test(status) || (days !== null && Number.isFinite(days) && days < 0)) {
          return { category: "expired", days: Number.isFinite(days) ? days : 0, date };
        }
        const expiryDate = expiryUtc === null ? null : new Date(expiryUtc);
        const monthDifference = expiryDate
          ? (expiryDate.getUTCFullYear() - today.getFullYear()) * 12 + expiryDate.getUTCMonth() - today.getMonth()
          : null;
        if (days !== null && Number.isFinite(days) && monthDifference !== null && monthDifference >= 0 && monthDifference <= 1) {
          return { category: "expiring", days: Number.isFinite(days) ? days : null, date };
        }
        return { category: "active", days: Number.isFinite(days) ? days : null, date };
      }

      function getDomainAlerts() {
        const domains = apiState.authenticated ? apiState.domains : state.domains;
        return domains.map((domain) => ({ domain, expiry: getDomainExpiry(domain) }))
          .filter(({ expiry }) => expiry.category !== "active")
          .sort((left, right) => {
            const leftPriority = left.expiry.category === "expired" ? 1 : 0;
            const rightPriority = right.expiry.category === "expired" ? 1 : 0;
            return leftPriority - rightPriority
              || (left.expiry.days ?? Number.MAX_SAFE_INTEGER) - (right.expiry.days ?? Number.MAX_SAFE_INTEGER);
          });
      }

      function getAccountName() {
        if (!apiState.authenticated) return "Sarah Anderson";
        const client = apiState.client;
        const fullName = [client?.firstname, client?.lastname].filter((part) => typeof part === "string" && part.trim()).join(" ").trim();
        if (fullName) return fullName;
        const displayName = [client?.fullname, client?.name].find((name) => typeof name === "string" && name.trim());
        if (displayName) return displayName.trim();
        const email = typeof client?.email === "string" ? client.email.trim() : "";
        return email ? email.split("@")[0] : "Tài khoản 123HOST";
      }

      function getAccountInitials() {
        if (!apiState.authenticated) return "SA";
        const name = getAccountName();
        return name === "Tài khoản 123HOST"
          ? "12"
          : name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => Array.from(part)[0]).join("").toLocaleUpperCase("vi-VN") || "12";
      }

      function getReadableApiNotifications() {
        const ignored = /^(thông báo từ 123host|notification from 123host|123host notification)$/i;
        const seen = new Set();
        return apiState.notifications.map((item) => {
          if (typeof item === "string") return { item, message: item.trim() };
          if (!item || typeof item !== "object") return null;
          const fields = ["message", "title", "text", "content", "subject", "description", "notification"];
          const message = fields.map((field) => item[field]).find((value) => typeof value === "string" && value.trim());
          return message ? { item, message: message.trim() } : null;
        }).filter((entry) => {
          if (!entry || !entry.message || ignored.test(entry.message)) return false;
          const key = `${entry.item?.id || ""}:${entry.message}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }

      function liveServiceCard(service) {
        const status = String(service.status || "Chưa rõ");
        const active = status.toLowerCase() === "active";
        return `<article class="hosting-card"><div class="card-heading"><div><div class="card-title">${esc(service.name || service.domain || "Dịch vụ")}</div><div class="card-caption">${esc(service.category || "Dịch vụ")} · ${esc(service.domain || "")}</div></div><span class="status-pill ${active ? "green" : "orange"}">${esc(status)}</span></div><div class="card-caption" style="margin-top:10px">Mã dịch vụ · ${esc(service.id)}${service.billingcycle ? ` · ${esc(service.billingcycle)}` : ""}${service.next_due ? ` · Hạn tiếp theo ${esc(formatDate(service.next_due))}` : ""}</div></article>`;
      }

      function siteCard(site) {
        const percent = Math.round(site.used / site.limit * 100);
        return `<article class="site-card"><div class="card-heading"><div class="site-head"><span class="site-icon">${icon("monitor", 16)}</span><div><div class="site-title">${esc(site.name)}</div><div class="card-caption">${esc(site.account)} · ${esc(site.server)}</div></div></div><span class="online-dot">Hoạt Động</span></div><div class="site-storage">${meter(`Dung lượng ${esc(site.name)}`, `${site.used}GB / ${site.limit}GB`, percent)}</div></article>`;
      }

      function statCard(iconName, label, value, hint = "") {
        return `<article class="stat-card"><span class="stat-icon">${icon(iconName,18)}</span><div><div class="stat-label">${label}</div><div class="stat-value">${value}</div></div>${hint ? `<span class="stat-hint">${hint}</span>` : ""}</article>`;
      }

      function renderHome() {
        const running = state.projects.filter((project) => project.status === "running").length;
        const completed = state.projects.filter((project) => project.status === "completed").length;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const late = state.projects.filter((project) => project.status === "running" && project.deadlineISO && new Date(`${project.deadlineISO}T00:00:00`) < today).length;
        const warningDomains = getDomainAlerts();
        return `${heading(`<span data-home-greeting>${getTimeGreeting()}, ${esc(getAccountName())}!</span>`, "Đây là tình hình dự án và dịch vụ của bạn hôm nay.")}
          <section class="grid stats-grid">${statCard("code","Dự án đang chạy",String(running).padStart(2,"0"),"Đang thực hiện")}${statCard("check","Đã hoàn thành",String(completed).padStart(2,"0"),"Tổng dự án")}${statCard("clock","Dự án quá hạn",String(late).padStart(2,"0"),"Cần chú ý")}${statCard("globe",apiState.authenticated ? "Tên miền 123HOST" : "Tên miền mẫu",String((apiState.authenticated ? apiState.domains : state.domains).length).padStart(2,"0"),apiState.authenticated ? "Đã đồng bộ" : "Dữ liệu mẫu")}</section>
          <div class="grid home-grid">
            <section class="panel">${section("Dự án đang chạy","Theo dõi tiến độ công việc của nhóm.",`<button class="link-button" type="button" data-route="projects">Tất cả dự án →</button>`)}<div class="project-list">${state.projects.filter((project) => project.status === "running").slice(0,3).map((project) => projectCard(project)).join("") || `<div class="empty-state">Chưa có dự án đang chạy.<br>Tạo một dự án mới để bắt đầu.</div>`}<button class="button primary" type="button" data-action="new-project">＋ &nbsp; Tạo Dự Án Mới</button></div></section>
            <div><section class="panel">${section("Cảnh báo tên miền","Ưu tiên tên miền sắp hết hạn; tên miền đã quá hạn xếp sau.",`<span class="count-badge">${warningDomains.length}</span>`)}<div class="domain-list">${warningDomains.slice(0,3).map(({ domain }) => apiState.authenticated ? liveDomainCard(domain) : domainCard(domain)).join("") || `<div class="empty-state">Không có tên miền nào sắp hết hạn.</div>`}</div><button class="link-button" style="margin-top:8px" type="button" data-route="domains">Quản lý tên miền →</button></section>
            <section class="panel">${section("Website khách hàng","Trạng thái dịch vụ hosting.")}<div class="client-list">${state.sites.slice(0,3).map((site) => `<div class="client-row"><span class="client-name">${esc(site.name)}</span><span class="online-dot">Hoạt Động</span></div>`).join("") || `<div class="empty-state">Chưa có website khách hàng.</div>`}</div></section></div>
          </div>`;
      }

      function renderProjects() {
        const shown = state.projects.filter((project) => projectFilter === "all" || project.status === projectFilter);
        const tabs = `<div class="tabs" role="group" aria-label="Lọc dự án"><button class="tab-button ${projectFilter === "all" ? "active" : ""}" type="button" data-action="project-filter" data-filter="all">Tất cả (${state.projects.length})</button><button class="tab-button ${projectFilter === "running" ? "active" : ""}" type="button" data-action="project-filter" data-filter="running">Đang chạy</button><button class="tab-button ${projectFilter === "completed" ? "active" : ""}" type="button" data-action="project-filter" data-filter="completed">Hoàn thành</button></div>`;
        return `${heading("Quản Lý Dự Án","Theo dõi tiến độ, thành viên và danh sách công việc.",`<button class="button primary" type="button" data-action="new-project">＋ &nbsp; Tạo Dự Án Mới</button>`)}
          <div class="toolbar">${tabs}<span class="card-caption">${state.projects.length} dự án trong không gian làm việc</span></div>
          <div class="project-list">${shown.map((project) => projectCard(project, true)).join("") || `<div class="empty-state">Không có dự án trong danh mục này.</div>`}</div>`;
      }

      function renderDomains() {
        const query = domainQuery.trim().toLocaleLowerCase("vi");
        if (apiState.authenticated) {
          const domainRows = apiState.domains.map((domain) => ({ domain, expiry: getDomainExpiry(domain) }));
          const priority = { expiring: 0, expired: 1, active: 2 };
          domainRows.sort((left, right) => {
            return priority[left.expiry.category] - priority[right.expiry.category]
              || (left.expiry.days ?? Number.MAX_SAFE_INTEGER) - (right.expiry.days ?? Number.MAX_SAFE_INTEGER)
              || String(left.domain.name || "").localeCompare(String(right.domain.name || ""), "vi");
          });
          const domainExpiryCounts = domainRows.reduce((result, { expiry }) => {
            result[expiry.category] += 1;
            return result;
          }, { expired: 0, expiring: 0, active: 0 });
          const alertDomains = domainRows.filter(({ expiry }) => expiry.category !== "active");
          const alertCounts = {
            expiring: alertDomains.filter(({ expiry }) => expiry.category === "expiring").length,
            expired: alertDomains.filter(({ expiry }) => expiry.category === "expired").length
          };
          const filtered = domainRows.filter(({ domain, expiry }) => {
            const matchesFilter = domainFilter === "all" || expiry.category === domainFilter;
            const searchable = `${domain.name || ""} ${domain.id || ""} ${domain.status || ""} ${domain.expires || ""}`.toLocaleLowerCase("vi");
            return matchesFilter && searchable.includes(query);
          });
          const pageSize = 10;
          const visible = filtered.slice(0, domainPage * pageSize);
          const domainTabs = `<div class="domain-filter-tabs" role="group" aria-label="Lọc danh sách tên miền"><button class="domain-filter-button ${domainFilter === "all" ? "active" : ""}" type="button" data-action="domain-filter" data-filter="all">Tất cả <span>${domainRows.length}</span></button><button class="domain-filter-button ${domainFilter === "expired" ? "active" : ""}" type="button" data-action="domain-filter" data-filter="expired">Đã hết hạn <span>${alertCounts.expired}</span></button><button class="domain-filter-button ${domainFilter === "expiring" ? "active" : ""}" type="button" data-action="domain-filter" data-filter="expiring">Sắp hết hạn <span>${alertCounts.expiring}</span></button><button class="domain-filter-button ${domainFilter === "active" ? "active" : ""}" type="button" data-action="domain-filter" data-filter="active">Hoạt động <span>${domainExpiryCounts.active}</span></button></div>`;
          const syncedAt = apiState.domainsLastSyncedAt
            ? `Dữ liệu 123HOST · Cập nhật ${new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(apiState.domainsLastSyncedAt)}`
            : "Đang lấy dữ liệu mới nhất từ 123HOST";
          return `${heading("Tên Miền & DNS",`${syncedAt}. Hiển thị cảnh báo hết hạn trong tháng này và tháng sau.`,`<button class="button" type="button" data-action="refresh-domains" ${apiState.domainSyncing ? "disabled" : ""}>${apiState.domainSyncing ? "↻ &nbsp; Đang đồng bộ..." : "↻ &nbsp; Đồng Bộ Tên Miền"}</button>`)}
            <section class="grid domain-summary-grid">${statCard("globe","Tổng tên miền",String(domainRows.length),"Trong tài khoản")}${statCard("calendar","Sắp hết hạn",String(alertCounts.expiring),"Tháng này và tháng sau")}${statCard("clock","Đã hết hạn",String(alertCounts.expired),"Cần xử lý")}</section>
            <div class="panel">${section("Danh sách tên miền",`${visible.length} / ${filtered.length} kết quả · Ưu tiên sắp hết hạn`, `<span class="status-pill green">Đã kết nối</span>`)}
              ${apiState.domainError ? `<div class="modal-message domain-error" role="alert">${esc(apiState.domainError)}<br><button class="link-button" type="button" data-action="refresh-domains">Thử đồng bộ lại →</button></div>` : ""}
              <label class="search-field">${icon("search",15)}<input type="search" data-search-domains placeholder="Tìm tên miền..." aria-label="Tìm tên miền" value="${esc(domainQuery)}"></label>
              ${domainTabs}
              <div class="domain-list" style="margin-top:13px">${visible.map(({ domain }) => liveDomainCard(domain)).join("") || `<div class="empty-state">${domainRows.length ? "Không tìm thấy tên miền phù hợp." : "Tài khoản chưa có tên miền nào."}</div>`}</div>
              ${visible.length < filtered.length ? `<button class="button domain-load-more" type="button" data-action="more-domains">Hiện thêm ${Math.min(pageSize, filtered.length - visible.length)} tên miền</button>` : ""}
            </div>`;
        }
        const filtered = state.domains.filter((domain) => `${domain.name} ${domain.dns} ${domain.owner}`.toLocaleLowerCase("vi").includes(query));
        return `${heading("Tên Miền & DNS","Tìm kiếm, gia hạn và cấu hình các tên miền của bạn.",`<button class="button primary" type="button" data-action="new-domain">＋ &nbsp; Thêm Tên Miền</button>`)}
          <div class="panel">${section("Tất cả tên miền",`${state.domains.length} tên miền đang được quản lý.`)}
            <label class="search-field">${icon("search",15)}<input type="search" data-search-domains placeholder="Tìm tên miền, DNS..." aria-label="Tìm tên miền hoặc DNS" value="${esc(domainQuery)}"></label>
            ${state.transfers.length ? `<div class="card-caption" style="margin-top:12px">Yêu cầu chuyển tên miền đã lưu: ${state.transfers.length}</div>` : ""}
            <div class="domain-list" style="margin-top:13px">${filtered.map(domainCard).join("") || `<div class="empty-state">Không tìm thấy tên miền phù hợp.<br>Thử tìm theo tên miền hoặc máy chủ DNS.</div>`}</div>
          </div>`;
      }

      function renderHosting() {
        if (apiState.authenticated) {
          return `${heading("Dịch Vụ Hosting","Danh sách dịch vụ đồng bộ từ tài khoản 123HOST.",`<button class="button" type="button" data-action="refresh-api">↻ &nbsp; Đồng bộ</button>`)}
            <div class="grid hosting-grid">
              <section class="panel">${section("Dịch vụ đang sử dụng",`${apiState.servicesLoaded ? `${apiState.services.length} dịch vụ trong tài khoản 123HOST.` : "Đang tải dữ liệu dịch vụ..."}`,`<span class="status-pill green">Trực tiếp</span>`)}<div class="hosting-list">${apiState.services.map(liveServiceCard).join("") || `<div class="empty-state">${apiState.servicesLoaded ? "Tài khoản chưa có dịch vụ hosting." : "Đang đồng bộ từ 123HOST..."}</div>`}</div></section>
              <section class="panel">${section("Hóa đơn gần đây", "Chọn một hóa đơn để xem chi tiết.")}<div class="hosting-list">${apiState.invoices.map((invoice) => `<article class="hosting-card"><div class="card-heading"><div><div class="card-title">Hóa đơn #${esc(invoice.number || invoice.id)}</div><div class="card-caption">${esc(formatDate(invoice.date || ""))}${invoice.duedate ? ` · Hạn thanh toán ${esc(formatDate(invoice.duedate))}` : ""}</div></div><span class="status-pill ${String(invoice.status).toLowerCase() === "paid" ? "green" : "orange"}">${esc(invoice.status || "Chưa rõ")}</span></div><div class="card-caption" style="margin-top:9px">Tổng tiền · ${esc(formatMoney(invoice.total, invoice.currency))}</div><button class="button small" style="margin-top:10px" type="button" data-action="api-invoice" data-id="${esc(invoice.id)}">Xem hóa đơn →</button></article>`).join("") || `<div class="empty-state">${apiState.invoicesLoaded ? "Tài khoản chưa có hóa đơn." : "Đang đồng bộ từ 123HOST..."}</div>`}</div></section>
              <section class="panel">${section("Thông tin tài khoản", "Số dư và tín dụng từ 123HOST.")}<div class="modal-message">${!apiState.balanceLoaded ? "Đang tải số dư..." : apiState.balance?.details ? `Đơn vị tiền tệ: <strong>${esc(apiState.balance.details.currency || "")}</strong><br>Số dư hóa đơn: <strong>${esc(formatMoney(apiState.balance.details.acc_balance, apiState.balance.details.currency))}</strong><br>Tín dụng: <strong>${esc(formatMoney(apiState.balance.details.acc_credit, apiState.balance.details.currency))}</strong>` : "123HOST không trả về thông tin số dư."}</div></section>
            </div>`;
        }
        const total = state.accounts.reduce((sum, account) => sum + Number(account.used), 0);
        return `${heading("Hosting & VPS","Quản lý tài khoản DirectAdmin và hiệu suất máy chủ.",`<button class="button primary" type="button" data-action="new-vps">＋ &nbsp; Thêm VPS Mới</button>`)}
          <div class="grid hosting-grid">
            <section class="panel">${section("Tài khoản DirectAdmin","Thông tin kết nối máy chủ của bạn.")}<div class="hosting-list">${state.accounts.map((account) => `<article class="hosting-card"><div class="card-heading"><div><div class="card-title">${esc(account.name)}</div><div class="card-caption">Địa chỉ IP · ${esc(account.ip)}</div></div><button class="link-button" type="button" data-action="account-details" data-id="${esc(account.name)}">Chi tiết →</button></div><div class="storage-row ${account.color === "orange" ? "orange" : ""}"><span>Dung lượng sử dụng</span><strong>${Number(account.used).toFixed(1)}GB / ${Number(account.limit).toFixed(1)}GB</strong><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,account.used/account.limit*100)}%"></div></div></div></article>`).join("")}</div>
            <article class="hosting-card" style="margin-top:12px"><div class="card-heading"><div class="card-title">Thống kê dung lượng</div><span class="status-pill">Tổng ${total.toFixed(1)}GB</span></div><div class="storage-row"><span>Green Account</span><strong>${Number(state.accounts[0]?.used || 0).toFixed(1)}GB</strong></div><div class="storage-row orange"><span>Orange Account</span><strong>${Number(state.accounts[1]?.used || 0).toFixed(1)}GB</strong></div><div class="card-caption" style="margin-top:12px">Tổng space đang sử dụng: <strong style="color:#eaf4ff">${total.toFixed(1)}GB</strong></div></article>
            </section>
            <section class="panel">${section("Máy chủ VPS",`${state.vps.length} máy chủ đang được theo dõi.`)}<div class="hosting-list">${state.vps.map((server) => `<article class="hosting-card"><div class="card-heading"><div><div class="card-title">${esc(server.name)}</div><div class="card-caption">${esc(server.ip)} · Máy chủ đang hoạt động</div></div><span class="status-pill green">Hoạt động</span></div>${progress("Mức sử dụng CPU",server.cpu)}${meter("Bộ nhớ RAM",`${server.ram}GB / ${server.limit}GB`,server.ram/server.limit*100)}<div class="project-footer"><span class="deadline">Theo dõi tài nguyên theo thời gian thực</span><button class="link-button" type="button" data-action="vps-details" data-id="${esc(server.id)}">Xem chi tiết →</button></div></article>`).join("") || `<div class="empty-state">Chưa có máy chủ VPS.</div>`}</div></section>
          </div>`;
      }

      function renderSettings() {
        const settings = [
          ["shield","Tài Khoản & Bảo Mật","Quản lý hồ sơ và phiên đăng nhập","account"],
          ["plug","Cấu hình API DirectAdmin","Kết nối và thông tin xác thực máy chủ","api"],
          ["link","Liên Kết VPS","Quản lý kết nối đến máy chủ của bạn","vps"],
          ["bell","Tùy Chọn Thông Báo",state.notifications ? "Đang bật thông báo dự án và tên miền" : "Thông báo đang tắt","notifications"],
          ["life","Liên Hệ Hỗ Trợ","Gửi câu hỏi cho đội ngũ DevHQ","support"]
        ];
        return `${heading("Cài Đặt Hệ Thống","Quản lý tài khoản và tùy chỉnh không gian làm việc.")}
          <section class="panel">${section("Kết nối tài khoản 123HOST","Đăng nhập để đồng bộ tên miền, dịch vụ, hóa đơn và thông tin tài khoản.",`<span class="status-pill ${apiState.loading ? "orange" : apiState.authenticated ? "green" : "orange"}">${apiState.loading ? "Đang đồng bộ" : apiState.authenticated ? "Đã kết nối" : "Chưa kết nối"}</span>`)}
            ${apiState.authenticated ? `<div class="card-heading"><div><div class="card-title">${esc(getAccountName())}</div><div class="card-caption">${esc(apiState.client?.email || (apiState.loading ? "Đang tải dữ liệu tài khoản..." : "Đã đăng nhập · Dữ liệu được tải trực tiếp"))}</div></div><div style="display:flex;gap:8px"><button class="button small" type="button" data-action="refresh-api" ${apiState.loading ? "disabled" : ""}>${apiState.loading ? "Đang đồng bộ..." : "Đồng bộ"}</button><button class="button small" type="button" data-action="disconnect-api">Ngắt kết nối</button></div></div>` : `<div class="card-heading"><div class="card-caption">Thông tin đăng nhập được gửi qua localhost và không lưu trong trình duyệt.</div><button class="button primary" type="button" data-action="connect-api">Kết Nối 123HOST</button></div>`}
            <div class="card-caption" style="margin-top:12px">${apiState.domains.length} tên miền đã đồng bộ${apiState.servicesLoaded || apiState.invoicesLoaded ? ` · ${apiState.services.length} dịch vụ · ${apiState.invoices.length} hóa đơn` : " · Dịch vụ và hóa đơn sẽ tải khi mở Hosting"}</div>
          </section>
          <section class="panel">${section("Tài khoản",apiState.authenticated ? `${apiState.client?.email || "Tài khoản 123HOST"} · Tài khoản đã kết nối` : "Sarah Anderson · Quản trị viên")}<button class="setting-card" type="button" data-action="profile"><span class="avatar">${getAccountInitials()}</span><span class="setting-copy"><span class="setting-title">${esc(getAccountName())}</span><span class="setting-description" style="display:block">${esc(apiState.client?.email || (apiState.authenticated ? "Đang tải thông tin tài khoản..." : "Quản trị viên · Gói chuyên nghiệp"))}</span></span><span class="chevron">›</span></button></section>
          <section class="panel">${section("Tùy chọn hệ thống","Chọn một mục để xem và cập nhật cài đặt.")}<div class="settings-list">${settings.map(([symbol,title,description,key]) => `<button class="setting-card" type="button" data-action="setting" data-key="${key}"><span class="setting-icon">${icon(symbol,17)}</span><span class="setting-copy"><span class="setting-title">${title}</span><span class="setting-description" style="display:block">${description}</span></span><span class="chevron">›</span></button>`).join("")}</div></section>
          <section class="panel">${section("Gia hạn tên miền","Nhắc nhở trước khi dịch vụ của bạn hết hạn.")}<button class="setting-card" type="button" data-action="toggle-auto-renew"><span class="setting-icon">${icon("globe",17)}</span><span class="setting-copy"><span class="setting-title">Nhắc gia hạn tên miền</span><span class="setting-description" style="display:block">${state.autoRenew ? "Bạn sẽ nhận nhắc nhở tự động." : "Bật nhắc nhở trước ngày hết hạn."}</span></span><span class="status-pill ${state.autoRenew ? "green" : ""}">${state.autoRenew ? "Đang bật" : "Đang tắt"}</span></button></section>`;
      }

      function render() {
        const renderers = { home: renderHome, projects: renderProjects, domains: renderDomains, hosting: renderHosting, settings: renderSettings };
        appView.innerHTML = renderers[currentScreen]();
        updateTopbar();
        document.querySelectorAll("[data-route]").forEach((link) => {
          const active = link.dataset.route === currentScreen;
          link.classList.toggle("active", active);
          if (active) link.setAttribute("aria-current", "page");
          else link.removeAttribute("aria-current");
        });
        document.title = `${screenNames[currentScreen]} — DevHQ`;
      }

      async function apiRequest(path, options = {}) {
        const response = await fetch(path, {
          method: options.method || "GET",
          credentials: "same-origin",
          headers: options.body ? { "Content-Type": "application/json" } : {},
          body: options.body ? JSON.stringify(options.body) : undefined
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || `Yêu cầu thất bại (${response.status}).`);
        }
        return payload;
      }

      async function loadApiData() {
        if (apiLoadPromise) return apiLoadPromise;
        apiLoadPromise = loadApiDataOnce();
        try {
          return await apiLoadPromise;
        } finally {
          apiLoadPromise = null;
        }
      }

      function extractApiList(data, key) {
        if (Array.isArray(data)) return data;
        if (Array.isArray(data?.[key])) return data[key];
        if (Array.isArray(data?.data)) return data.data;
        return null;
      }

      async function loadApiDomains() {
        if (domainLoadPromise) return domainLoadPromise;
        apiState.domainSyncing = true;
        if (currentScreen === "domains") render();
        domainLoadPromise = (async () => {
          try {
            const data = await apiRequest("/api/123host/domains");
            const domains = extractApiList(data, "domains");
            if (!domains || domains.some((domain) => !domain || typeof domain !== "object" || domain.id === undefined || typeof domain.name !== "string" || !domain.name.trim())) {
              throw new Error("123HOST trả về danh sách tên miền thiếu hoặc sai định dạng.");
            }
            apiState.domains = domains;
            apiState.domainError = "";
            apiState.domainsLastSyncedAt = new Date();
            return domains;
          } catch (error) {
            apiState.domainError = error.message;
            throw error;
          } finally {
            apiState.domainSyncing = false;
            domainLoadPromise = null;
            render();
          }
        })();
        return domainLoadPromise;
      }

      async function loadApiDataOnce() {
        apiState.loading = true;
        render();
        const failures = [];
        const [domainResult, detailsResult] = await Promise.allSettled([
          loadApiDomains(),
          apiRequest("/api/123host/details")
        ]);
        if (domainResult.status === "rejected") {
          failures.push(`domains: ${domainResult.reason.message}`);
          apiState.domainError = domainResult.reason.message;
        }
        if (detailsResult.status === "fulfilled") {
          apiState.client = detailsResult.value.client || apiState.client;
        } else {
          failures.push(`details: ${detailsResult.reason.message}`);
        }
        apiState.loading = false;
        render();
        if (failures.length) {
          console.error("Một số API 123HOST không tải được:", failures);
          const domainFailure = failures.find((failure) => failure.startsWith("domains: "));
          notify(domainFailure ? `Tên miền chưa đồng bộ được: ${domainFailure.slice("domains: ".length)}` : `Đã đồng bộ ${apiState.domains.length} tên miền; thông tin hồ sơ chưa tải được.`);
        } else {
          notify(`Đã đồng bộ ${apiState.domains.length} tên miền và hồ sơ 123HOST.`);
        }
        return failures;
      }

      async function loadApiHosting() {
        if (hostingLoadPromise) return hostingLoadPromise;
        if (apiState.servicesLoaded && apiState.invoicesLoaded && apiState.balanceLoaded) return;
        hostingLoadPromise = (async () => {
          const requests = [
            ["services", "/api/123host/services"],
            ["invoices", "/api/123host/invoices"],
            ["balance", "/api/123host/balance"]
          ];
          const failures = [];
          for (const [key, path] of requests) {
            try {
              const data = await apiRequest(path);
              if (key === "services") {
                const list = extractApiList(data, "services");
                if (!list) throw new Error("123HOST trả về danh sách dịch vụ sai định dạng.");
                apiState.services = list;
                apiState.servicesLoaded = true;
              } else if (key === "invoices") {
                const list = extractApiList(data, "invoices");
                if (!list) throw new Error("123HOST trả về danh sách hóa đơn sai định dạng.");
                apiState.invoices = list;
                apiState.invoicesLoaded = true;
              } else {
                apiState.balance = data;
                apiState.balanceLoaded = true;
              }
              render();
            } catch (error) {
              failures.push(`${key}: ${error.message}`);
            }
          }
          if (failures.length) {
            console.error("Một số dữ liệu Hosting 123HOST chưa tải được:", failures);
            notify(`Một số dữ liệu Hosting chưa đồng bộ được: ${failures.join("; ")}`);
          }
        })();
        try {
          await hostingLoadPromise;
        } finally {
          hostingLoadPromise = null;
        }
      }

      async function initializeApiSession() {
        try {
          const session = await apiRequest("/api/session");
          apiState.authenticated = session.authenticated === true;
          apiState.client = session.client || null;
          render();
          if (apiState.authenticated) {
            await loadApiData();
            if (currentScreen === "hosting") await loadApiHosting();
          }
        } catch (error) {
          console.error("Không thể kiểm tra phiên 123HOST:", error);
        }
      }

      async function connectApi(form) {
        if (form.dataset.submitting === "true") return;
        const submitButton = modalRoot.querySelector('button[form="modal-form"][data-action="connect-api"]');
        const loginStatus = form.querySelector("[data-api-login-status]");
        const originalLabel = submitButton?.textContent || "";
        form.dataset.submitting = "true";
        if (loginStatus) {
          loginStatus.hidden = false;
          loginStatus.textContent = "Đang xác thực thông tin với 123HOST...";
        }
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = "Đang kết nối...";
        }
        notify("Đang kết nối tài khoản 123HOST...");
        const values = new FormData(form);
        try {
          await apiRequest("/api/login", { method: "POST", body: { username: values.get("username"), password: values.get("password") } });
          apiState.authenticated = true;
          apiState.client = { email: String(values.get("username")).trim() };
          closeModal();
          render();
          notify("Đăng nhập 123HOST thành công. Đang đồng bộ dữ liệu...");
          await loadApiData();
          if (currentScreen === "hosting") await loadApiHosting();
        } catch (error) {
          console.error("Đăng nhập 123HOST thất bại:", error);
          if (loginStatus) loginStatus.textContent = error.message;
          notify(error.message);
        } finally {
          if (form.isConnected) {
            form.dataset.submitting = "false";
            if (submitButton?.isConnected) {
              submitButton.disabled = false;
              submitButton.textContent = originalLabel;
            }
          }
        }
      }

      async function openApiNameservers(domain) {
        const result = await apiRequest(`/api/123host/domains/${encodeURIComponent(domain.id)}/nameservers`);
        const servers = Array.isArray(result.nameservers) ? result.nameservers : Array.isArray(result) ? result : [];
        const body = `<form id="modal-form" class="form-grid"><input type="hidden" name="domainId" value="${esc(domain.id)}"><div class="modal-message">Máy chủ tên miền cho <strong>${esc(domain.name)}</strong>. Cập nhật có thể ảnh hưởng đến website và email.</div>${[0,1,2,3].map((index) => `<label class="field">Máy chủ tên miền ${index + 1}${index < 2 ? '<span aria-hidden="true"> *</span>' : ""}<input name="nameserver${index + 1}" maxlength="253" value="${esc(servers[index] || "")}" ${index < 2 ? "required" : ""} placeholder="ns${index + 1}.example.com"></label>`).join("")}</form>`;
        openModal("Máy Chủ Tên Miền", "Cập nhật cấu hình trực tiếp tại 123HOST.", body, "Cập Nhật DNS", "save-api-nameservers");
      }

      async function loadApiRecords(domain) {
        const result = await apiRequest(`/api/123host/domains/${encodeURIComponent(domain.id)}/records`);
        const records = Array.isArray(result) ? result : Array.isArray(result.records) ? result.records : Array.isArray(result.data?.records) ? result.data.records : null;
        if (!records) throw new Error("123HOST trả về danh sách bản ghi DNS sai định dạng.");
        apiState.dnsRecords[String(domain.id)] = records;
        return records;
      }

      async function loadApiRecordTypes(domain) {
        if (apiState.dnsRecordTypes.length || apiState.dnsRecordTypesPromise) return;
        apiState.dnsRecordTypesPromise = (async () => {
          try {
            const result = await apiRequest(`/api/123host/domains/${encodeURIComponent(domain.id)}/records/types`);
            const types = Array.isArray(result) ? result : Array.isArray(result.types) ? result.types : Array.isArray(result.data?.types) ? result.data.types : [];
            const validTypes = types.filter((type) => typeof type === "string" && type.trim());
            if (!validTypes.length) throw new Error("123HOST chưa trả về loại DNS hợp lệ.");
            apiState.dnsRecordTypes = validTypes;
            apiState.dnsRecordTypesError = "";
          } catch (error) {
            console.warn("Không tải được loại DNS từ API 123HOST; dùng danh sách theo tài liệu:", error);
            apiState.dnsRecordTypes = documentedDnsRecordTypes;
            apiState.dnsRecordTypesError = "123HOST chưa trả danh sách loại DNS; biểu mẫu đang dùng các loại được hỗ trợ theo tài liệu.";
          } finally {
            apiState.dnsRecordTypesPromise = null;
          }
        })();
        await apiState.dnsRecordTypesPromise;
      }

      function renderApiRecords(domain, records) {
        const rows = records.map((record) => `<article class="hosting-card"><div class="card-heading"><div class="card-title">${esc(record.name || "@")} · ${esc(record.type || "")}</div><span class="card-caption">TTL ${esc(record.ttl ?? 0)}</span></div><div class="card-caption" style="margin-top:7px;overflow-wrap:anywhere">${esc(record.content || "")}${record.priority ? ` · Ưu tiên ${esc(record.priority)}` : ""}</div><div class="form-actions"><button class="button small" type="button" data-action="edit-api-record" data-domain-id="${esc(domain.id)}" data-domain-name="${esc(domain.name)}" data-record-id="${esc(record.id)}" data-name="${esc(record.name || "")}" data-type="${esc(record.type || "A")}" data-content="${esc(record.content || "")}" data-priority="${esc(record.priority || 0)}">Chỉnh Sửa</button><button class="button danger small" type="button" data-action="delete-api-record" data-domain-id="${esc(domain.id)}" data-record-id="${esc(record.id)}">Xóa</button></div></article>`).join("");
        const body = `${apiState.dnsRecordTypesError ? `<div class="modal-message">${esc(apiState.dnsRecordTypesError)}</div>` : ""}<div class="hosting-list">${rows || `<div class="empty-state">Chưa có bản ghi DNS.</div>`}</div><button class="button primary" style="margin-top:13px" type="button" data-action="add-api-record" data-domain-id="${esc(domain.id)}" data-domain-name="${esc(domain.name)}">＋ &nbsp; Thêm Bản Ghi</button>`;
        openModal(`DNS · ${esc(domain.name)}`, "Các bản ghi đang được quản lý trực tiếp tại 123HOST.", body, "", "", false);
      }

      async function openApiRecords(domain) {
        const records = await loadApiRecords(domain);
        renderApiRecords(domain, records);
        if (!apiState.dnsRecordTypes.length) {
          loadApiRecordTypes(domain).then(() => {
            if (modalRoot.querySelector(".modal-title")?.textContent === `DNS · ${domain.name}`) {
              renderApiRecords(domain, apiState.dnsRecords[String(domain.id)] || []);
            }
          });
        }
      }

      function refreshApiRecordsInBackground(domain) {
        loadApiRecords(domain).then((records) => {
          if (modalRoot.querySelector(".modal-title")?.textContent === `DNS · ${domain.name}`) {
            renderApiRecords(domain, records);
          }
        }).catch((error) => {
          console.error("Đã ghi DNS nhưng không thể xác minh lại danh sách từ 123HOST:", error);
          notify(`Đã lưu thay đổi DNS nhưng chưa xác minh lại được: ${error.message}`);
        });
      }

      function openApiRecordForm(domainId, domainName, record = null) {
        const editing = Boolean(record);
        const availableTypes = apiState.dnsRecordTypes.length ? apiState.dnsRecordTypes : documentedDnsRecordTypes;
        const recordTypes = record?.type && !availableTypes.includes(record.type) ? [...availableTypes, record.type] : availableTypes;
        const typeDescription = apiState.dnsRecordTypesError || (apiState.dnsRecordTypes.length ? "Loại bản ghi được tải từ 123HOST." : "Danh sách loại bản ghi đang tải; có thể chỉnh sửa ngay bằng các loại tương thích phổ biến.");
        const body = `<form id="modal-form" class="form-grid"><input type="hidden" name="domainId" value="${esc(domainId)}">${editing ? `<input type="hidden" name="recordId" value="${esc(record.id)}">` : ""}<label class="field">Tên bản ghi<input name="name" required maxlength="253" value="${esc(record?.name || "")}" placeholder="@ hoặc www"></label><label class="field">Loại bản ghi<select name="type">${recordTypes.map((type) => `<option ${record?.type === type ? "selected" : ""}>${esc(type)}</option>`).join("")}</select></label><label class="field">Giá trị<input name="content" required maxlength="2048" value="${esc(record?.content || "")}" placeholder="Địa chỉ IP hoặc giá trị bản ghi"></label><label class="field">Độ ưu tiên<input name="priority" type="number" min="0" max="65535" value="${esc(record?.priority || 0)}"></label><div class="modal-message">${esc(typeDescription)} Thay đổi DNS thật có thể ảnh hưởng đến website và cần thời gian cập nhật.</div></form>`;
        openModal(editing ? "Chỉnh Sửa Bản Ghi DNS" : "Thêm Bản Ghi DNS", `Cập nhật ${esc(domainName)} trực tiếp tại 123HOST.`, body, editing ? "Lưu Bản Ghi" : "Thêm Bản Ghi", editing ? "update-api-record" : "create-api-record");
      }

      function openApiInvoice(invoice) {
        const items = Array.isArray(invoice.items) ? invoice.items : [];
        const itemRows = items.map((item) => `<article class="hosting-card"><div class="card-title">${esc(item.description || "Khoản phí")}</div><div class="card-caption">${esc(item.qty || "1")} × ${esc(formatMoney(item.amount ?? item.linetotal, invoice.currency))}</div><div class="card-caption" style="margin-top:7px">Thành tiền · ${esc(formatMoney(item.linetotal ?? item.amount, invoice.currency))}</div></article>`).join("");
        const details = `<div class="hosting-list">${itemRows || `<div class="empty-state">Hóa đơn không có chi tiết khoản mục.</div>`}</div><div class="modal-message" style="margin-top:12px">Trạng thái: <strong>${esc(invoice.status || "Chưa rõ")}</strong><br>Ngày tạo: ${esc(formatDate(invoice.date) || "—")}<br>Hạn thanh toán: ${esc(formatDate(invoice.duedate || invoice.paybefore) || "—")}${invoice.datepaid ? `<br>Ngày thanh toán: ${esc(formatDate(invoice.datepaid))}` : ""}<br><br>Tạm tính: <strong>${esc(formatMoney(invoice.subtotal ?? invoice.total, invoice.currency))}</strong><br>Thuế: <strong>${esc(formatMoney(invoice.tax, invoice.currency))}</strong><br>Tổng cộng: <strong>${esc(formatMoney(invoice.total, invoice.currency))}</strong>${invoice.notes ? `<br><br>Ghi chú: ${esc(invoice.notes)}` : ""}</div>`;
        openModal(`Hóa Đơn #${esc(invoice.number || invoice.id)}`, "Chi tiết hóa đơn đồng bộ trực tiếp từ 123HOST.", details, "", "", false);
      }

      function openApiLogin() {
        if (window.location.protocol === "file:") {
          openModal("Cần Chạy Máy Chủ Cục Bộ", "Để kết nối an toàn với 123HOST, chạy ứng dụng bằng PowerShell thay vì mở trực tiếp tệp HTML.", `<div class="modal-message">Mở Terminal trong thư mục dự án và chạy:<br><br><strong>powershell -ExecutionPolicy Bypass -File .\\server.ps1</strong><br><br>Sau đó truy cập <strong>http://127.0.0.1:8000</strong>.</div>`, "", "", false);
          return;
        }
        const body = `<form id="modal-form" class="form-grid"><div class="modal-message">Thông tin đăng nhập được gửi an toàn tới máy chủ để xác thực. Mật khẩu và mã JWT không được lưu trong trình duyệt.</div><label class="field">Email tài khoản 123HOST<input name="username" type="email" required autocomplete="username" maxlength="254" placeholder="ban@email.com"></label><label class="field">Mật khẩu<input name="password" type="password" required autocomplete="current-password"></label><div class="modal-message" data-api-login-status role="status" aria-live="polite" hidden></div></form>`;
        openModal("Kết Nối 123HOST", "Đăng nhập để đồng bộ dữ liệu tài khoản thật.", body, "Đăng Nhập", "connect-api");
      }

      function openNotifications() {
        const alerts = getDomainAlerts();
        const notices = apiState.authenticated ? getReadableApiNotifications() : [];
        const alertRow = ({ domain, expiry }) => {
          const text = expiry.category === "expired"
            ? expiry.days < 0 ? `Đã quá hạn ${Math.abs(expiry.days)} ngày` : "Đã hết hạn"
            : expiry.days === 0 ? "Hết hạn hôm nay" : `Còn ${expiry.days} ngày`;
          const expiryDate = expiry.date !== "Chưa có thông tin" ? ` · Hạn ${esc(expiry.date)}` : "";
          return `<article class="hosting-card"><div class="card-heading"><div><div class="card-title">${esc(domain.name || "Tên miền")}</div><div class="card-caption">${text}${expiryDate}</div></div><span class="status-pill ${expiry.category === "expired" ? "red" : "orange"}">${expiry.category === "expired" ? "Cần xử lý" : "Sắp hết hạn"}</span></div><button class="link-button" style="margin-top:8px" type="button" data-action="open-domain-alert" data-name="${esc(domain.name || "")}">Xem tên miền →</button></article>`;
        };
        const expired = alerts.filter(({ expiry }) => expiry.category === "expired");
        const upcoming = alerts.filter(({ expiry }) => expiry.category !== "expired");
        const currentMonth = new Date();
        const thisMonth = upcoming.filter(({ expiry }) => {
          const date = expiry.date.match(/^\d{2}\/(\d{2})\/(\d{4})$/);
          return date && Number(date[1]) === currentMonth.getMonth() + 1 && Number(date[2]) === currentMonth.getFullYear();
        });
        const laterByMonth = upcoming.filter((alert) => !thisMonth.includes(alert));
        const monthGroups = new Map();
        for (const alert of laterByMonth) {
          const date = alert.expiry.date.match(/^\d{2}\/(\d{2})\/(\d{4})$/);
          const key = date ? `${date[1]}/${date[2]}` : "Chưa rõ tháng";
          monthGroups.set(key, [...(monthGroups.get(key) || []), alert]);
        }
        const noticeRows = notices.map(({ item, message }) => {
          const acknowledge = /^\d+$/.test(String(item?.id || "")) ? `<button class="button small" type="button" data-action="ack-api-notification" data-id="${esc(item.id)}">Đã đọc</button>` : "";
          return `<article class="hosting-card"><div class="card-caption">${esc(formatDate(item?.created_at || item?.date || ""))}</div><div class="card-title" style="margin-top:5px">${esc(message)}</div>${acknowledge}</article>`;
        }).join("");
        const alertSections = [
        thisMonth.length ? `<div class="card-title" style="margin:14px 0 8px">Sắp hết hạn trong tháng ${String(currentMonth.getMonth() + 1).padStart(2, "0")}/${currentMonth.getFullYear()} · ${thisMonth.length}</div><div class="hosting-list">${thisMonth.map(alertRow).join("")}</div>` : "",
        ...Array.from(monthGroups, ([month, items]) => `<div class="card-title" style="margin:14px 0 8px">Sắp hết hạn tháng ${month} · ${items.length}</div><div class="hosting-list">${items.map(alertRow).join("")}</div>`),
        expired.length ? `<div class="card-title" style="margin:14px 0 8px">Tên miền đã hết hạn · ${expired.length}</div><div class="hosting-list">${expired.map(alertRow).join("")}</div>` : ""
        ].join("");
        const syncWarning = apiState.authenticated && apiState.domainError
          ? `<div class="modal-message">Chưa thể cập nhật danh sách tên miền từ API 123HOST: ${esc(apiState.domainError)}. Dữ liệu cảnh báo đang là lần đồng bộ thành công gần nhất.<br><button class="link-button" type="button" data-action="refresh-domains">Thử đồng bộ lại →</button></div>`
          : "";
        const sections = `${syncWarning}${alertSections}${notices.length ? `<div class="card-title" style="margin:14px 0 8px">Thông báo 123HOST · ${notices.length}</div><div class="hosting-list">${noticeRows}</div>` : ""}`;
        const emptyMessage = apiState.authenticated && !apiState.notificationsLoaded
          ? "Đang tải thông báo tài khoản..."
          : apiState.notificationsError || "Không có tên miền sắp hết hạn hoặc thông báo mới.";
        const summary = `${upcoming.length} tên miền sắp hết hạn trong tháng này và tháng sau${expired.length ? ` · ${expired.length} đã hết hạn` : ""}`;
        openModal("Thông Báo", `${summary}${apiState.authenticated ? ` · ${notices.length} thông báo mới từ 123HOST` : ""}. Cảnh báo tên miền dùng cùng danh sách và ngày hết hạn API với màn Tên Miền & DNS.`, `<div class="hosting-list">${sections || `<div class="empty-state">${esc(emptyMessage)}</div>`}</div>`, "", "", false);
      }

      async function showNotifications() {
        openNotifications();
        if (!apiState.authenticated) return;
        let notificationRequest = notificationsLoadPromise;
        if (!notificationRequest) {
          notificationRequest = (async () => {
            const result = await apiRequest("/api/123host/notifications");
            const notifications = extractApiList(result, "notifications");
            if (!notifications) throw new Error("123HOST trả về danh sách thông báo sai định dạng.");
            apiState.notifications = notifications;
            apiState.notificationsLoaded = true;
            apiState.notificationsError = "";
          })();
          notificationsLoadPromise = notificationRequest;
        }
        try {
          const [domainResult, notificationResult] = await Promise.allSettled([loadApiDomains(), notificationRequest]);
          const failures = [];
          if (domainResult.status === "rejected") failures.push(`Tên miền: ${domainResult.reason.message}`);
          if (notificationResult.status === "rejected") {
            apiState.notificationsError = `Không tải được thông báo 123HOST: ${notificationResult.reason.message}`;
            apiState.notificationsLoaded = true;
            failures.push(`Thông báo: ${notificationResult.reason.message}`);
          }
          if (failures.length) notify(`Chưa đồng bộ đầy đủ dữ liệu 123HOST: ${failures.join("; ")}`);
          render();
          openNotifications();
        } finally {
          if (notificationsLoadPromise === notificationRequest) notificationsLoadPromise = null;
        }
      }

      async function openApiRenewal(domain) {
        if (!apiState.paymentsLoaded) {
          const result = await apiRequest("/api/123host/payments");
          apiState.payments = result.payments || {};
          apiState.paymentsLoaded = true;
        }
        const available = Object.entries(apiState.payments);
        if (!available.length) {
          notify("Tài khoản 123HOST không có phương thức thanh toán khả dụng.");
          return;
        }
        const body = `<form id="modal-form" class="form-grid"><input type="hidden" name="domainId" value="${esc(domain.id)}"><div class="modal-message"><strong>${esc(domain.name)}</strong><br>Đây là thao tác thật trên tài khoản 123HOST và có thể phát sinh thanh toán. Chỉ xác nhận nếu bạn muốn gửi yêu cầu gia hạn.</div><label class="field">Thời hạn gia hạn<select name="years"><option value="1">1 năm</option><option value="2">2 năm</option><option value="3">3 năm</option></select></label><label class="field">Phương thức thanh toán<select name="paymentMethod">${available.map(([id, name]) => `<option value="${esc(id)}">${esc(name)}</option>`).join("")}</select></label></form>`;
        openModal("Xác Nhận Gia Hạn", "Yêu cầu được gửi trực tiếp đến nhà đăng ký tên miền.", body, "Gửi Yêu Cầu Gia Hạn", "renew-api-domain");
      }

      function notify(message) {
        toast.textContent = message;
        toast.classList.add("visible");
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2800);
      }

      function updateTopbar() {
        const client = apiState.client;
        const name = getAccountName();
        const initials = getAccountInitials();
        const profileName = document.querySelector("[data-profile-name]");
        const profileRole = document.querySelector("[data-profile-role]");
        const profileAvatar = document.querySelector("[data-profile-avatar]");
        const profileButton = document.querySelector(".user-chip");
        const notificationButton = document.querySelector("[data-action='notifications']");
        const notificationDot = document.querySelector("[data-notification-dot]");
        if (profileName) profileName.textContent = name;
        if (profileRole) profileRole.textContent = apiState.authenticated
          ? apiState.loading ? "Đang đồng bộ 123HOST..." : client?.email || "Tài khoản 123HOST"
          : "Quản trị viên";
        if (profileAvatar) profileAvatar.textContent = initials;
        if (profileButton) profileButton.setAttribute("aria-label", `Hồ sơ ${name}`);

        const domainAlertCount = getDomainAlerts().length;
        const portalNotificationCount = apiState.authenticated ? getReadableApiNotifications().length : 0;
        if (notificationDot) notificationDot.hidden = domainAlertCount + portalNotificationCount === 0;
        if (notificationButton) {
          notificationButton.setAttribute(
            "aria-label",
            domainAlertCount || portalNotificationCount
              ? `Thông báo, ${domainAlertCount} cảnh báo tên miền và ${portalNotificationCount} thông báo mới từ 123HOST`
              : "Thông báo, không có cảnh báo tên miền mới"
          );
        }
      }

      function navigate(screen) {
        if (!Object.hasOwn(screenNames, screen)) return;
        currentScreen = screen;
        history.replaceState(null, "", `#${routeHashes[screen]}`);
        render();
        if (screen === "domains" && apiState.authenticated) {
          loadApiDomains().catch((error) => {
            console.error("Không thể cập nhật tên miền 123HOST khi mở danh sách:", error);
            notify(`Không tải được dữ liệu tên miền mới nhất: ${error.message}`);
          });
        }
        if (screen === "hosting" && apiState.authenticated) {
          loadApiHosting().catch((error) => {
            console.error("Không thể đồng bộ dịch vụ 123HOST:", error);
            notify(`Không tải được dữ liệu Hosting: ${error.message}`);
          });
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      function openModal(title, description, body, submitLabel = "Lưu thay đổi", submitAction = "modal-submit", showCancel = true) {
        modalRoot.innerHTML = `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 class="modal-title" id="modal-title">${title}</h2><p class="modal-description">${description}</p></div><button class="close-button" type="button" data-action="close-modal" aria-label="Đóng">×</button></div>${body}<div class="form-actions">${showCancel ? `<button class="button" type="button" data-action="close-modal">Hủy</button>` : ""}${submitLabel ? `<button class="button primary" type="submit" form="modal-form" data-action="${submitAction}">${submitLabel}</button>` : ""}</div></section></div>`;
        const firstInput = modalRoot.querySelector("input:not([type=hidden]), textarea, select");
        if (firstInput) firstInput.focus();
      }

      function closeModal() { modalRoot.innerHTML = ""; }

      function openProjectForm() {
        openModal("Tạo Dự Án Mới","Thêm dự án vào không gian làm việc của bạn.",`<form id="modal-form" class="form-grid"><label class="field">Tên dự án<input name="name" required maxlength="70" placeholder="Ví dụ: Website cửa hàng mới"></label><label class="field">Khách hàng hoặc mô tả<input name="client" maxlength="100" placeholder="Tên khách hàng"></label><label class="field">Ngày hoàn thành dự kiến<input name="deadline" type="date"></label></form>`,"Tạo dự án","create-project");
      }

      function openProjectEditForm(project) {
        const body = `<form id="modal-form" class="form-grid"><input type="hidden" name="projectId" value="${esc(project.id)}"><label class="field">Tên dự án<input name="name" required maxlength="70" value="${esc(project.name)}"></label><label class="field">Khách hàng hoặc mô tả<input name="client" maxlength="100" value="${esc(project.client)}"></label><label class="field">Ngày hoàn thành dự kiến<input name="deadline" type="date" value="${esc(project.deadlineISO || "")}"></label></form>`;
        openModal("Chỉnh Sửa Dự Án","Cập nhật thông tin dự án của bạn.",body,"Lưu thay đổi","update-project");
      }

      function projectTaskEditorRow(task = { text: "", done: false }) {
        return `<div class="project-task-editor" data-project-task><div class="task-row"><input type="checkbox" name="taskDone" value="true" ${task.done ? "checked" : ""}><input class="task-edit-input" name="taskText" required maxlength="160" value="${esc(task.text)}" placeholder="Nhập nội dung công việc"></div><button class="button danger small" type="button" data-action="remove-project-task" aria-label="Xóa công việc">Xóa</button></div>`;
      }

      function openProjectTasksForm(project) {
        const rows = project.tasks.map((task) => projectTaskEditorRow(task)).join("");
        const body = `<form id="modal-form" class="form-grid"><input type="hidden" name="projectId" value="${esc(project.id)}"><div class="project-task-editor-list">${rows || `<div class="card-caption" data-empty-project-tasks>Chưa có công việc. Hãy thêm công việc mới.</div>`}</div><button class="button" type="button" data-action="add-project-task">＋ &nbsp; Thêm công việc</button></form>`;
        openModal("Chỉnh Sửa Danh Sách Công Việc",`Cập nhật các đầu việc của dự án ${esc(project.name)}.`,body,"Lưu danh sách","update-project-tasks");
      }

      function openVpsForm() {
        openModal("Thêm VPS Mới","Lưu máy chủ vào danh sách theo dõi trên thiết bị này.",`<form id="modal-form" class="form-grid"><label class="field">Tên máy chủ<input name="name" required maxlength="50" placeholder="Ví dụ: VPS-production"></label><label class="field">Địa chỉ IP hoặc máy chủ<input name="ip" required maxlength="100" placeholder="Ví dụ: 103.97.126.81"></label><label class="field">Dung lượng RAM (GB)<input name="ram" type="number" min="1" max="1024" step="0.1" value="2"></label><label class="field">Mức sử dụng CPU (%)<input name="cpu" type="number" min="0" max="100" value="20"></label></form>`,"Thêm máy chủ","create-vps");
      }

      function openDomainForm() {
        openModal("Thêm Tên Miền","Thêm tên miền vào danh sách quản lý.",`<form id="modal-form" class="form-grid"><label class="field">Tên miền<input name="name" required maxlength="100" placeholder="tenmien.vn"></label><label class="field">Máy chủ DNS<input name="dns" required maxlength="100" value="ns1.devhq.vn"></label></form>`,"Thêm tên miền","create-domain");
      }

      function submitForm(action) {
        const form = document.querySelector("#modal-form");
        if (!form || !form.reportValidity()) return;
        const values = new FormData(form);
        if (action === "create-project") {
          const name = String(values.get("name")).trim();
          const deadlineISO = String(values.get("deadline") || "");
          state.projects.unshift({ id: `project-${Date.now()}`, name, client: String(values.get("client")).trim() || "Dự án mới", progress: 0, deadline: deadlineISO ? formatDate(deadlineISO) : "Chưa đặt", deadlineISO, status: "running", tasks: [{ text: "Lên kế hoạch công việc", done: false }, { text: "Thực hiện và kiểm tra tiến độ", done: false }] });
          projectFilter = "all";
          saveState(); closeModal(); navigate("projects"); notify("Đã tạo dự án mới.");
        } else if (action === "update-project") {
          const project = state.projects.find((item) => item.id === values.get("projectId"));
          if (!project) {
            notify("Không tìm thấy dự án cần chỉnh sửa.");
            return;
          }
          const name = String(values.get("name")).trim();
          if (!name) {
            notify("Tên dự án không được để trống.");
            return;
          }
          const deadlineISO = String(values.get("deadline") || "");
          project.name = name;
          project.client = String(values.get("client")).trim() || "Dự án mới";
          project.deadlineISO = deadlineISO;
          project.deadline = deadlineISO ? formatDate(deadlineISO) : "Chưa đặt";
          saveState(); closeModal(); render(); notify("Đã cập nhật dự án.");
        } else if (action === "update-project-tasks") {
          const project = state.projects.find((item) => item.id === values.get("projectId"));
          if (!project) {
            notify("Không tìm thấy dự án cần cập nhật công việc.");
            return;
          }
          const rows = Array.from(form.querySelectorAll("[data-project-task]"));
          const tasks = rows.map((row) => ({
            text: row.querySelector("[name='taskText']").value.trim(),
            done: row.querySelector("[name='taskDone']").checked
          })).filter((task) => task.text);
          project.tasks = tasks;
          project.progress = project.status === "completed" ? 100 : tasks.length ? Math.round(tasks.filter((task) => task.done).length / tasks.length * 100) : 0;
          saveState(); closeModal(); render(); notify("Đã cập nhật danh sách công việc.");
        } else if (action === "delete-project") {
          const project = state.projects.find((item) => item.id === values.get("projectId"));
          if (!project) {
            notify("Không tìm thấy dự án cần xóa.");
            return;
          }
          state.projects = state.projects.filter((item) => item.id !== project.id);
          saveState(); closeModal(); render(); notify(`Đã xóa dự án “${project.name}” và danh sách công việc của dự án.`);
        } else if (action === "create-vps") {
          const ram = Number(values.get("ram"));
          const cpu = Number(values.get("cpu"));
          if (!Number.isFinite(ram) || ram <= 0 || !Number.isFinite(cpu) || cpu < 0 || cpu > 100) {
            notify("Vui lòng nhập thông số máy chủ hợp lệ.");
            return;
          }
          state.vps.push({ id: `vps-${Date.now()}`, name: String(values.get("name")).trim(), ip: String(values.get("ip")).trim(), ram: 0, limit: ram, cpu });
          saveState(); closeModal(); render(); notify("Đã thêm máy chủ VPS.");
        } else if (action === "create-domain") {
          const name = String(values.get("name")).trim().toLowerCase();
          if (state.domains.some((domain) => domain.name.toLowerCase() === name)) {
            notify("Tên miền này đã có trong danh sách.");
            return;
          }
          state.domains.push({ id: `domain-${Date.now()}`, name, status: "active", days: null, expiry: "Chưa thiết lập", dns: String(values.get("dns")).trim(), owner: "Tài khoản của bạn" });
          saveState(); closeModal(); navigate("domains"); notify("Đã thêm tên miền.");
        }
      }

      function handleAction(action, target) {
        const id = target.dataset.id;
        if (action === "connect-api") openApiLogin();
        else if (action === "open-domain-alert") {
          domainQuery = target.dataset.name || "";
          domainPage = 1;
          closeModal();
          navigate("domains");
        }
        else if (action === "new-project") openProjectForm();
        else if (action === "new-vps") openVpsForm();
        else if (action === "new-domain") openDomainForm();
        else if (action === "close-modal") closeModal();
        else if (action === "backdrop-close" && target === modalRoot.firstElementChild) closeModal();
        else if (action === "project-filter") { projectFilter = target.dataset.filter; render(); }
        else if (action === "domain-filter") {
          domainFilter = target.dataset.filter;
          domainPage = 1;
          render();
        }
        else if (action === "more-domains") {
          domainPage += 1;
          render();
        }
        else if (action === "edit-project") {
          const project = state.projects.find((item) => item.id === id);
          if (project) openProjectEditForm(project);
        }
        else if (action === "delete-project") {
          const project = state.projects.find((item) => item.id === id);
          if (project) {
            const body = `<form id="modal-form" class="form-grid"><input type="hidden" name="projectId" value="${esc(project.id)}"><div class="modal-message">Bạn có chắc muốn xóa <strong>${esc(project.name)}</strong>? Toàn bộ danh sách công việc của dự án này cũng sẽ bị xóa.</div></form>`;
            openModal("Xóa Dự Án", "Thao tác này không thể hoàn tác.", body, "Xóa Dự Án", "delete-project");
          }
        }
        else if (action === "edit-project-tasks") {
          const project = state.projects.find((item) => item.id === id);
          if (project) openProjectTasksForm(project);
        }
        else if (action === "expand-project") {
          const project = state.projects.find((item) => item.id === id);
          if (project) openModal(project.name,"Công việc và tiến độ dự án.",`<div class="modal-message">${project.tasks.map((task) => `${task.done ? "✓" : "○"} ${esc(task.text)}`).join("<br>")}<br><br>Tiến độ hiện tại: <strong>${project.progress}%</strong></div>`, "", "", false);
        } else if (action === "toggle-project") {
          const project = state.projects.find((item) => item.id === id);
          if (project) {
            project.status = project.status === "completed" ? "running" : "completed";
            if (project.status === "completed") project.progress = 100;
            saveState(); render(); notify(project.status === "completed" ? "Đã đánh dấu dự án hoàn thành." : "Đã mở lại dự án.");
          }
        } else if (action === "renew-domain") {
          const domain = state.domains.find((item) => item.id === id);
          if (domain) openModal("Gia Hạn Tên Miền",`Xác nhận gia hạn ${esc(domain.name)} trên dữ liệu quản lý cục bộ.`,`<form id="modal-form" class="form-grid"><input name="domainId" type="hidden" value="${esc(id)}"><div class="modal-message">Tên miền hiện còn <strong>${domain.days} ngày</strong>.<br>Thao tác này cập nhật hạn sử dụng hiển thị trong ứng dụng, không thực hiện thanh toán với nhà đăng ký tên miền.</div></form>`,"Xác nhận gia hạn","confirm-renew");
        } else if (action === "domain-dns") {
          const domain = state.domains.find((item) => item.id === id);
          if (domain) openModal("Cấu Hình DNS",`Cập nhật máy chủ DNS cho ${esc(domain.name)}.`,`<form id="modal-form" class="form-grid"><input type="hidden" name="domainId" value="${esc(id)}"><label class="field">Máy chủ DNS<input name="dns" required maxlength="100" value="${esc(domain.dns)}"></label></form>`,"Lưu cấu hình","save-dns");
        } else if (action === "domain-transfer") {
          const domain = state.domains.find((item) => item.id === id);
          if (domain) openModal("Chuyển Tên Miền",`Gửi yêu cầu chuyển ${esc(domain.name)} sang nhà cung cấp khác.`,`<form id="modal-form" class="form-grid"><input type="hidden" name="domainId" value="${esc(id)}"><div class="modal-message">Bản demo chỉ lưu yêu cầu trong trình duyệt, chưa gửi đến nhà cung cấp.</div><label class="field">Nhà cung cấp tiếp nhận<input name="provider" required maxlength="80" placeholder="Tên nhà cung cấp"></label></form>`,"Lưu yêu cầu","transfer-domain");
        } else if (action === "toggle-auto-renew") {
          state.autoRenew = !state.autoRenew; saveState(); render(); notify(state.autoRenew ? "Đã bật nhắc gia hạn tên miền." : "Đã tắt nhắc gia hạn tên miền.");
        } else if (action === "setting") showSetting(target.dataset.key);
        else if (action === "account-details") {
          const account = state.accounts.find((item) => item.name === id);
          if (account) openModal(account.name,"Thông tin tài khoản DirectAdmin.",`<div class="modal-message">Địa chỉ IP: <strong>${esc(account.ip)}</strong><br>Dung lượng đang dùng: <strong>${account.used}GB / ${account.limit}GB</strong><br><br>Đây là thông tin mẫu trong ứng dụng. Chưa kết nối máy chủ DirectAdmin.</div>`,"","",false);
        } else if (action === "vps-details") {
          const server = state.vps.find((item) => item.id === id);
          if (server) openModal(server.name,"Thông tin máy chủ VPS.",`<div class="modal-message">Địa chỉ máy chủ: <strong>${esc(server.ip)}</strong><br>CPU đang dùng: <strong>${server.cpu}%</strong><br>RAM: <strong>${server.ram}GB / ${server.limit}GB</strong><br><br>Số liệu máy chủ mẫu, chưa đồng bộ với VPS thực tế.</div>`,"","",false);
        } else if (action === "profile") {
          const name = getAccountName();
          const email = apiState.client?.email || (apiState.authenticated ? "Đang đồng bộ thông tin tài khoản..." : "Quản trị viên · Không gian làm việc DevHQ");
          openModal("Tài Khoản Của Bạn","Thông tin tài khoản đang đăng nhập.",`<div class="modal-message"><strong>${esc(name)}</strong><br>${esc(email)}<br><br>${apiState.authenticated ? "Thông tin đồng bộ trực tiếp từ 123HOST." : "Dữ liệu hồ sơ mẫu."}</div>`,"","",false);
        }
      }

      async function runApiAction(action, target) {
        if (action === "connect-api") {
          openApiLogin();
          return;
        }
        if (action === "refresh-api") {
          if (!apiState.authenticated) { openApiLogin(); return; }
          await loadApiData();
          if (currentScreen === "hosting") {
            apiState.servicesLoaded = false;
            apiState.invoicesLoaded = false;
            apiState.balanceLoaded = false;
            await loadApiHosting();
          }
          return;
        }
        if (action === "disconnect-api") {
          let remoteLogoutConfirmed = true;
          try {
            const result = await apiRequest("/api/logout", { method: "POST" });
            remoteLogoutConfirmed = result.remoteLogoutConfirmed !== false;
          } catch (error) {
            console.error("Không xác nhận được thao tác đăng xuất 123HOST:", error);
            remoteLogoutConfirmed = false;
          }
          apiState.authenticated = false;
          apiState.client = null;
          apiState.domains = [];
          apiState.services = [];
          apiState.servicesLoaded = false;
          apiState.invoices = [];
          apiState.invoicesLoaded = false;
          apiState.payments = {};
          apiState.paymentsLoaded = false;
          apiState.balance = null;
          apiState.balanceLoaded = false;
          apiState.notifications = [];
          apiState.notificationsLoaded = false;
          apiState.notificationsError = "";
          apiState.dnsRecordTypes = [];
          apiState.dnsRecordTypesError = "";
          apiState.dnsRecords = {};
          render();
          notify(remoteLogoutConfirmed ? "Đã ngắt kết nối 123HOST." : "Đã thoát khỏi ứng dụng; 123HOST chưa xác nhận thu hồi phiên.");
          return;
        }
        if (action === "api-nameservers") {
          const domain = apiState.domains.find((item) => String(item.id) === target.dataset.id);
          if (domain) await openApiNameservers(domain);
          return;
        }
        if (action === "api-records") {
          const domain = apiState.domains.find((item) => String(item.id) === target.dataset.id);
          if (domain) await openApiRecords(domain);
          return;
        }
        if (action === "api-renew") {
          const domain = apiState.domains.find((item) => String(item.id) === target.dataset.id);
          if (domain) await openApiRenewal(domain);
          return;
        }
        if (action === "api-invoice") {
          if (!/^\d+$/.test(target.dataset.id || "")) {
            notify("Mã hóa đơn 123HOST không hợp lệ.");
            return;
          }
          const result = await apiRequest(`/api/123host/invoices/${encodeURIComponent(target.dataset.id)}`);
          const invoice = result.invoice || result;
          if (!invoice || typeof invoice !== "object") throw new Error("123HOST trả về chi tiết hóa đơn không hợp lệ.");
          openApiInvoice(invoice);
          return;
        }
        if (action === "ack-api-notification") {
          if (!/^\d+$/.test(target.dataset.id || "")) {
            notify("Mã thông báo 123HOST không hợp lệ.");
            return;
          }
          await apiRequest(`/api/123host/notifications/${encodeURIComponent(target.dataset.id)}/ack`, { method: "PUT" });
          apiState.notifications = apiState.notifications.filter((item) => String(item?.id) !== target.dataset.id);
          apiState.notificationsLoaded = true;
          render();
          openNotifications();
          notify("Đã đánh dấu thông báo 123HOST là đã đọc.");
          return;
        }
        if (action === "add-api-record") {
          openApiRecordForm(target.dataset.domainId, target.dataset.domainName);
          return;
        }
        if (action === "edit-api-record") {
          openApiRecordForm(target.dataset.domainId, target.dataset.domainName, {
            id: target.dataset.recordId,
            name: target.dataset.name,
            type: target.dataset.type,
            content: target.dataset.content,
            priority: target.dataset.priority
          });
          return;
        }
        if (action === "delete-api-record") {
          const domain = apiState.domains.find((item) => String(item.id) === target.dataset.domainId);
          openModal("Xóa Bản Ghi DNS", "Thao tác này xóa bản ghi thật trên 123HOST và có thể làm gián đoạn dịch vụ.", `<form id="modal-form" class="form-grid"><input type="hidden" name="domainId" value="${esc(target.dataset.domainId)}"><input type="hidden" name="recordId" value="${esc(target.dataset.recordId)}"><div class="modal-message">Bạn có chắc muốn xóa bản ghi DNS của <strong>${esc(domain?.name || "tên miền này")}</strong>?</div></form>`, "Xóa Bản Ghi", "confirm-delete-api-record");
        }
      }

      async function submitApiForm(action, form) {
        const values = new FormData(form);
        if (action === "connect-api") {
          await connectApi(form);
          return;
        }
        if (action === "save-api-nameservers") {
          const domainId = String(values.get("domainId"));
          const nameservers = [1,2,3,4].map((index) => String(values.get(`nameserver${index}`) || "").trim()).filter(Boolean);
          await apiRequest(`/api/123host/domains/${encodeURIComponent(domainId)}/nameservers`, { method: "PUT", body: { nameservers } });
          closeModal();
          notify("Đã cập nhật máy chủ tên miền trên 123HOST.");
          return;
        }
        if (action === "renew-api-domain") {
          const domainId = String(values.get("domainId"));
          await apiRequest(`/api/123host/domains/${encodeURIComponent(domainId)}/renew`, { method: "POST", body: { years: Number(values.get("years")), paymentMethod: Number(values.get("paymentMethod")) } });
          closeModal();
          notify("123HOST đã nhận yêu cầu gia hạn. Kiểm tra hóa đơn để xác nhận thanh toán.");
          apiState.invoicesLoaded = false;
          await loadApiDomains();
          if (currentScreen === "hosting") await loadApiHosting();
          return;
        }
        if (action === "create-api-record" || action === "update-api-record") {
          const domainId = String(values.get("domainId"));
          const recordId = String(values.get("recordId") || "");
          const body = { name: String(values.get("name")).trim(), type: String(values.get("type")), content: String(values.get("content")).trim(), priority: Number(values.get("priority")) || 0 };
          const route = `/api/123host/domains/${encodeURIComponent(domainId)}/records${action === "update-api-record" ? `/${encodeURIComponent(recordId)}` : ""}`;
          const result = await apiRequest(route, { method: action === "create-api-record" ? "POST" : "PUT", body });
          const domain = apiState.domains.find((item) => String(item.id) === domainId);
          closeModal();
          if (domain) {
            const records = apiState.dnsRecords[domainId];
            if (records) {
              if (action === "update-api-record") {
                apiState.dnsRecords[domainId] = records.map((record) => String(record.id) === recordId ? { ...record, ...body } : record);
              } else {
                const created = result && typeof result === "object" ? result.record || result.data?.record || result : null;
                if (created && typeof created === "object" && created.id !== undefined) {
                  apiState.dnsRecords[domainId] = [...records, { ...body, ...created }];
                }
              }
            }
            renderApiRecords(domain, apiState.dnsRecords[domainId] || []);
            notify("Đã lưu bản ghi DNS trên 123HOST.");
            refreshApiRecordsInBackground(domain);
          } else {
            notify("Đã lưu bản ghi DNS trên 123HOST.");
          }
          return;
        }
        if (action === "confirm-delete-api-record") {
          const domainId = String(values.get("domainId"));
          const recordId = String(values.get("recordId"));
          await apiRequest(`/api/123host/domains/${encodeURIComponent(domainId)}/records/${encodeURIComponent(recordId)}`, { method: "DELETE" });
          const domain = apiState.domains.find((item) => String(item.id) === domainId);
          closeModal();
          if (domain) {
            if (apiState.dnsRecords[domainId]) {
              apiState.dnsRecords[domainId] = apiState.dnsRecords[domainId].filter((record) => String(record.id) !== recordId);
            }
            renderApiRecords(domain, apiState.dnsRecords[domainId] || []);
            notify("Đã xóa bản ghi DNS trên 123HOST.");
            refreshApiRecordsInBackground(domain);
          } else {
            notify("Đã xóa bản ghi DNS trên 123HOST.");
          }
          return;
        }
      }

      function showSetting(key) {
        const settings = {
          account: ["Tài Khoản & Bảo Mật","Quản lý thông tin người dùng.",apiState.authenticated ? `Tên tài khoản: ${esc(getAccountName())}<br>Email: ${esc(apiState.client?.email || (apiState.loading ? "Đang đồng bộ..." : "Chưa tải được email tài khoản"))}<br><br>Thông tin hồ sơ được đồng bộ từ 123HOST.` : "Tên tài khoản: Sarah Anderson<br>Vai trò: Quản trị viên<br><br>Đây là tài khoản mẫu của ứng dụng."],
          api: ["Cấu Hình API DirectAdmin","Quản lý kết nối máy chủ hosting.","Chưa kết nối DirectAdmin.<br>Để kết nối máy chủ thật, cần cấu hình API an toàn trên máy chủ backend; không nhập khóa bí mật vào ứng dụng trình duyệt."],
          vps: ["Liên Kết VPS","Danh sách máy chủ đã lưu trong ứng dụng.",`Hiện có ${state.vps.length} máy chủ VPS.<br>Địa chỉ IP và thông số đang là dữ liệu mẫu do bạn nhập.`],
          notifications: ["Tùy Chọn Thông Báo","Cài đặt nhận nhắc nhở dịch vụ.",`Trạng thái thông báo: <strong>${state.notifications ? "Đang bật" : "Đang tắt"}</strong>.<br>Nhắc gia hạn tên miền: <strong>${state.autoRenew ? "Đang bật" : "Đang tắt"}</strong>.`],
          support: ["Liên Hệ Hỗ Trợ","Gửi câu hỏi đến đội ngũ DevHQ.",`<form id="modal-form" class="form-grid"><label class="field">Email của bạn<input name="email" type="email" required placeholder="ban@email.com"></label><label class="field">Nội dung cần hỗ trợ<textarea name="message" required maxlength="1000" placeholder="Mô tả vấn đề bạn gặp phải"></textarea></label></form>`]
        };
        const item = settings[key];
        if (!item) return;
        if (key === "support") {
          openModal(item[0],item[1],item[2],"Gửi yêu cầu","send-support");
        } else {
          openModal(item[0],item[1],`<div class="modal-message">${item[2]}</div>${key === "notifications" ? `<button class="button" style="margin-top:12px" type="button" data-action="toggle-notifications">${state.notifications ? "Tắt thông báo" : "Bật thông báo"}</button>` : ""}`,"","",false);
        }
      }

      document.addEventListener("click", (event) => {
        const route = event.target.closest("[data-route]");
        if (route) {
          event.preventDefault();
          navigate(route.dataset.route);
          return;
        }
        const actionTarget = event.target.closest("[data-action]");
        if (!actionTarget) return;
        const action = actionTarget.dataset.action;
        if (action === "backdrop-close" && event.target !== actionTarget) return;
        if (action === "add-project-task") {
          const list = modalRoot.querySelector(".project-task-editor-list");
          if (!list) return;
          list.querySelector("[data-empty-project-tasks]")?.remove();
          list.insertAdjacentHTML("beforeend", projectTaskEditorRow());
          list.querySelector("[data-project-task]:last-child [name='taskText']").focus();
          return;
        }
        if (action === "remove-project-task") {
          const list = actionTarget.closest(".project-task-editor-list");
          actionTarget.closest("[data-project-task]")?.remove();
          if (list && !list.querySelector("[data-project-task]")) {
            list.innerHTML = `<div class="card-caption" data-empty-project-tasks>Chưa có công việc. Hãy thêm công việc mới.</div>`;
          }
          return;
        }
        if (action === "refresh-domains") {
          if (!apiState.authenticated || apiState.domainSyncing) return;
          loadApiDomains().then((domains) => {
            notify(`Đã đồng bộ ${domains.length} tên miền.`);
          }).catch((error) => {
            console.error("Không thể đồng bộ tên miền 123HOST:", error);
            notify(`Tên miền chưa đồng bộ được: ${error.message}`);
          });
          return;
        }
        if (actionTarget.type === "submit" && actionTarget.form?.id === "modal-form") return;
        if (action === "notifications") {
          showNotifications().catch((error) => {
            console.error("Không thể tải thông báo 123HOST:", error);
            apiState.notificationsError = `Không tải được thông báo 123HOST: ${error.message}`;
            apiState.notificationsLoaded = true;
            openNotifications();
            notify(`Không tải được thông báo 123HOST: ${error.message}`);
          });
          return;
        }
        if (action === "modal-submit" || action === "create-project" || action === "create-vps" || action === "create-domain" || action === "save-dns" || action === "transfer-domain" || action === "confirm-renew" || action === "send-support") return;
        if (action === "connect-api" || action === "refresh-api" || action === "disconnect-api" || action.startsWith("api-") || ["add-api-record", "edit-api-record", "delete-api-record", "ack-api-notification"].includes(action)) {
          runApiAction(action, actionTarget).catch((error) => {
            console.error("Thao tác 123HOST thất bại:", error);
            notify(error.message);
          });
          return;
        }
        if (action === "toggle-notifications") {
          state.notifications = !state.notifications; saveState(); closeModal(); render(); notify(state.notifications ? "Đã bật thông báo." : "Đã tắt thông báo."); return;
        }
        handleAction(action, actionTarget);
      });

      document.addEventListener("change", (event) => {
        const input = event.target;
        if (input.matches("[data-action='task-toggle']")) {
          const project = state.projects.find((item) => item.id === input.dataset.id);
          if (!project || !project.tasks[input.dataset.index]) return;
          project.tasks[input.dataset.index].done = input.checked;
          project.progress = project.status === "completed" ? 100 : Math.round(project.tasks.filter((task) => task.done).length / project.tasks.length * 100);
          saveState(); render();
        }
      });

      document.addEventListener("input", (event) => {
        if (event.target.matches("[data-search-domains]")) {
          domainQuery = event.target.value;
          domainPage = 1;
          const caret = event.target.selectionStart;
          render();
          const search = appView.querySelector("[data-search-domains]");
          search.focus();
          search.setSelectionRange(caret, caret);
        }
      });

      document.addEventListener("submit", (event) => {
        if (event.target.id !== "modal-form") return;
        event.preventDefault();
        const action = event.submitter?.dataset.action || modalRoot.querySelector("[type='submit'][data-action]")?.dataset.action;
        if (!action) return;
        if (["connect-api", "save-api-nameservers", "renew-api-domain", "create-api-record", "update-api-record", "confirm-delete-api-record"].includes(action)) {
          if (!event.target.reportValidity()) return;
          const form = event.target;
          if (action === "connect-api") {
            submitApiForm(action, form).catch((error) => {
              console.error("Đăng nhập 123HOST thất bại:", error);
              notify(error.message);
            });
            return;
          }
          if (form.dataset.submitting === "true") return;
          const submitButton = modalRoot.querySelector(`button[form="modal-form"][data-action="${action}"]`);
          const originalLabel = submitButton?.textContent || "";
          form.dataset.submitting = "true";
          if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Đang xử lý...";
          }
          submitApiForm(action, form).catch((error) => {
            console.error("Thao tác 123HOST thất bại:", error);
            notify(error.message);
          }).finally(() => {
            if (form.isConnected) {
              form.dataset.submitting = "false";
              if (submitButton?.isConnected) {
                submitButton.disabled = false;
                submitButton.textContent = originalLabel;
              }
            }
          });
          return;
        }
        if (action === "create-project" || action === "update-project" || action === "update-project-tasks" || action === "delete-project" || action === "create-vps" || action === "create-domain") {
          submitForm(action);
        } else if (action === "save-dns") {
          const values = new FormData(event.target);
          const domain = state.domains.find((item) => item.id === values.get("domainId"));
          if (domain) { domain.dns = String(values.get("dns")).trim(); saveState(); closeModal(); render(); notify("Đã lưu cấu hình DNS."); }
        } else if (action === "confirm-renew") {
          const id = new FormData(event.target).get("domainId");
          const domain = state.domains.find((item) => item.id === id);
          if (domain) {
            const renewedAt = new Date();
            renewedAt.setFullYear(renewedAt.getFullYear() + 1);
            domain.status = "active";
            domain.days = 365;
            domain.expiry = formatDate(`${renewedAt.getFullYear()}-${String(renewedAt.getMonth() + 1).padStart(2, "0")}-${String(renewedAt.getDate()).padStart(2, "0")}`);
            saveState(); closeModal(); render(); notify("Đã cập nhật hạn tên miền trong ứng dụng.");
          }
        } else if (action === "transfer-domain") {
          const values = new FormData(event.target);
          const domain = state.domains.find((item) => item.id === values.get("domainId"));
          if (!domain) { notify("Không tìm thấy tên miền cần chuyển."); return; }
          state.transfers.unshift({ domainId: domain.id, domainName: domain.name, provider: String(values.get("provider")).trim(), createdAt: new Date().toISOString(), status: "Đang chờ xử lý" });
          saveState(); closeModal(); render(); notify("Đã lưu yêu cầu chuyển tên miền trong ứng dụng.");
        } else if (action === "send-support") {
          closeModal(); notify("Đã ghi nhận yêu cầu hỗ trợ của bạn.");
        }
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && modalRoot.firstElementChild) closeModal();
      });

      window.addEventListener("hashchange", () => {
        const slug = location.hash.slice(1);
        const screen = Object.keys(routeHashes).find((key) => routeHashes[key] === slug);
        if (screen && screen !== currentScreen) navigate(screen);
      });

      const firstRoute = Object.keys(routeHashes).find((key) => routeHashes[key] === location.hash.slice(1));
      if (firstRoute) currentScreen = firstRoute;
      render();
      const splash = document.querySelector("#app-splash");
      if (splash) {
        window.setTimeout(() => {
          splash.classList.add("is-hidden");
          window.setTimeout(() => splash.remove(), 260);
        }, 850);
      }
      window.setInterval(updateHomeGreeting, 60_000);
      window.addEventListener("focus", updateHomeGreeting);
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) updateHomeGreeting();
      });
      if (window.location.protocol !== "file:") initializeApiSession();
    })();
