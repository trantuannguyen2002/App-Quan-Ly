param(
  [int]$Port = 8000
)

$ErrorActionPreference = "Stop"
$root = [System.IO.Path]::GetFullPath($PSScriptRoot)
$apiBase = "https://client.123host.vn/api"
$sessions = @{}
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Write-JsonResponse {
  param(
    [System.Net.HttpListenerResponse]$Response,
    [int]$StatusCode,
    $Value,
    [string]$SetCookie = ""
  )

  $json = ConvertTo-Json -InputObject $Value -Depth 30 -Compress
  $bytes = $script:utf8.GetBytes($json)
  $Response.StatusCode = $StatusCode
  $Response.ContentType = "application/json; charset=utf-8"
  $Response.Headers["Cache-Control"] = "no-store"
  $Response.Headers["X-Content-Type-Options"] = "nosniff"
  if ($SetCookie) {
    $Response.AppendHeader("Set-Cookie", $SetCookie)
  }
  $Response.ContentLength64 = $bytes.Length
  $Response.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Read-JsonBody {
  param([System.Net.HttpListenerRequest]$Request)

  $reader = New-Object System.IO.StreamReader($Request.InputStream, $Request.ContentEncoding)
  try {
    $body = $reader.ReadToEnd()
  } finally {
    $reader.Dispose()
  }
  if (-not $body) {
    return [PSCustomObject]@{}
  }
  try {
    return ConvertFrom-Json -InputObject $body -ErrorAction Stop
  } catch {
    throw "JSON trong yêu cầu không hợp lệ."
  }
}

function Encode-Query {
  param([hashtable]$Parameters)

  $parts = @()
  foreach ($key in $Parameters.Keys) {
    $value = $Parameters[$key]
    if ($value -is [array]) {
      $value = $value -join ","
    }
    $parts += ([System.Uri]::EscapeDataString([string]$key) + "=" + [System.Uri]::EscapeDataString([string]$value))
  }
  if ($parts.Count -eq 0) {
    return ""
  }
  return "?" + ($parts -join "&")
}

function Get-UpstreamFailure {
  param($ErrorRecord)

  $status = 502
  $message = "Dịch vụ 123HOST hiện không trả lời. Vui lòng thử lại sau."
  $exception = $ErrorRecord.Exception
  if ($exception.Response -and $exception.Response.StatusCode) {
    $status = [int]$exception.Response.StatusCode
    if ($status -eq 429) {
      $message = "123HOST đang giới hạn yêu cầu đăng nhập (HTTP 429). Vui lòng đợi rồi thử lại."
      try {
        $retryAfter = [string]$exception.Response.Headers["Retry-After"]
        $retrySeconds = 0
        if ([int]::TryParse($retryAfter, [ref]$retrySeconds) -and $retrySeconds -gt 0) {
          $message = "123HOST đang giới hạn yêu cầu đăng nhập. Vui lòng đợi khoảng $retrySeconds giây rồi thử lại."
        }
      } catch {
        Write-Verbose "Không đọc được thời gian chờ Retry-After từ 123HOST."
      }
    } elseif ($status -eq 401 -or $status -eq 403) {
      $message = "123HOST từ chối đăng nhập. Hãy kiểm tra email, mật khẩu và quyền API của tài khoản."
    } elseif ($status -ge 500) {
      $message = "Máy chủ 123HOST đang gặp sự cố (HTTP $status). Vui lòng thử lại sau."
    }
    try {
      $stream = $exception.Response.GetResponseStream()
      if ($stream) {
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
        $reader.Dispose()
        if ($body) {
          $parsed = ConvertFrom-Json -InputObject $body -ErrorAction SilentlyContinue
          if ($status -ne 429 -and $status -ne 401 -and $status -ne 403 -and $status -lt 500 -and $parsed) {
            $upstreamMessage = if ($parsed.message) { [string]$parsed.message } elseif ($parsed.error) { [string]$parsed.error } else { "" }
            if ($upstreamMessage -and $upstreamMessage -notmatch "(?i)password|token|secret|authorization") {
              $message = $upstreamMessage
            }
          }
        }
      }
    } catch {
      Write-Verbose "Không đọc được nội dung lỗi từ 123HOST."
    }
  } elseif ($exception.Message -match "timed out|timeout|name could not be resolved|actively refused|unable to connect|could not establish trust|SSL") {
    $message = "Không kết nối được 123HOST. Vui lòng kiểm tra mạng rồi thử lại."
  }
  return @{ status = $status; message = $message }
}

function Get-ProviderAuthHeader {
  param($Session)

  if ($Session.authType -eq "Basic") {
    $credentials = [System.Text.Encoding]::UTF8.GetBytes("$($Session.username):$($Session.password)")
    return "Basic " + [Convert]::ToBase64String($credentials)
  }
  return "Bearer $($Session.token)"
}

function Invoke-ProviderRequest {
  param(
    [string]$SessionId,
    [string]$Method,
    [string]$Path,
    [hashtable]$Parameters = @{},
    $Body = $null
  )

  $session = $script:sessions[$SessionId]
  if (-not $session -or (-not $session.token -and $session.authType -ne "Basic")) {
    throw "Chưa đăng nhập vào tài khoản 123HOST."
  }

  $url = $script:apiBase + $Path + (Encode-Query -Parameters $Parameters)
  for ($attempt = 0; $attempt -lt 2; $attempt++) {
    $headers = @{ Authorization = "Bearer $($session.token)" }
    try {
      if ($session.authType -eq "Basic") {
        $headers.Authorization = Get-ProviderAuthHeader -Session $session
      }
      if ($null -ne $Body) {
        $payload = ConvertTo-Json -InputObject $Body -Depth 20 -Compress
        $result = Invoke-RestMethod -Uri $url -Method $Method -Headers $headers -ContentType "application/json" -Body $payload -TimeoutSec 30 -ErrorAction Stop
      } else {
        $result = Invoke-RestMethod -Uri $url -Method $Method -Headers $headers -TimeoutSec 30 -ErrorAction Stop
      }
      return ,$result
    } catch {
      $failure = Get-UpstreamFailure -ErrorRecord $_
      if ($failure.status -ne 401 -or $attempt -gt 0 -or -not $session.refresh) {
        throw [System.Exception]::new($failure.message, [System.Exception]::new([string]$failure.status))
      }

      try {
        $refreshBody = @{ refresh_token = $session.refresh } | ConvertTo-Json -Compress
        $refresh = Invoke-RestMethod -Uri ($script:apiBase + "/token") -Method Post -ContentType "application/json" -Body $refreshBody -TimeoutSec 30 -ErrorAction Stop
        if (-not $refresh.token) {
          throw "123HOST không trả về mã đăng nhập mới."
        }
        $session.token = [string]$refresh.token
        if ($refresh.refresh) {
          $session.refresh = [string]$refresh.refresh
        }
        $script:sessions[$SessionId] = $session
      } catch {
        $script:sessions.Remove($SessionId)
        throw "Phiên 123HOST đã hết hạn. Vui lòng đăng nhập lại."
      }
    }
  }
}

function Send-StaticFile {
  param(
    [System.Net.HttpListenerContext]$Context,
    [string]$RequestPath
  )

  if ($RequestPath -eq "/") {
    $RequestPath = "/index.html"
  }
  $relativePath = [System.Uri]::UnescapeDataString($RequestPath.TrimStart("/")).Replace("/", [System.IO.Path]::DirectorySeparatorChar)
  $fullPath = [System.IO.Path]::GetFullPath((Join-Path $script:root $relativePath))
  $rootPrefix = $script:root.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
  if (-not $fullPath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
    $Context.Response.StatusCode = 404
    $Context.Response.Close()
    return
  }
  $extensions = @{
    ".html" = "text/html; charset=utf-8"
    ".css" = "text/css; charset=utf-8"
    ".js" = "text/javascript; charset=utf-8"
    ".svg" = "image/svg+xml"
    ".json" = "application/json; charset=utf-8"
  }
  $extension = [System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()
  if ($extensions.ContainsKey($extension)) {
    $Context.Response.ContentType = $extensions[$extension]
  } else {
    $Context.Response.ContentType = "application/octet-stream"
  }
  $Context.Response.Headers["X-Content-Type-Options"] = "nosniff"
  $Context.Response.Headers["Cache-Control"] = "no-cache"
  $bytes = [System.IO.File]::ReadAllBytes($fullPath)
  $Context.Response.ContentLength64 = $bytes.Length
  $Context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $Context.Response.Close()
}

function Get-ApiRoute {
  param(
    [string]$SessionId,
    [string]$Method,
    [string]$Path,
    [System.Net.HttpListenerRequest]$Request,
    [System.Net.HttpListenerResponse]$Response
  )

  $now = [DateTime]::UtcNow
  foreach ($id in @($script:sessions.Keys)) {
    $storedSession = $script:sessions[$id]
    if ($now - $storedSession.lastActivity -gt [TimeSpan]::FromHours(8)) {
      $script:sessions.Remove($id)
    }
  }

  if ($Path -eq "/api/session" -and $Method -eq "GET") {
    $session = $script:sessions[$SessionId]
    if ($session) {
      $session.lastActivity = $now
      $script:sessions[$SessionId] = $session
    }
    return @{ status = 200; body = @{ authenticated = [bool]($session -and ($session.token -or $session.authType -eq "Basic")); client = $session.client } }
  }

  if ($Path -eq "/api/login" -and $Method -eq "POST") {
    $credentials = Read-JsonBody -Request $Request
    $username = [string]$credentials.username
    $password = [string]$credentials.password
    if (-not $username.Trim() -or -not $password) {
      return @{ status = 400; body = @{ error = "Nhập email và mật khẩu tài khoản 123HOST." } }
    }
    try {
      $loginBody = @{ username = $username.Trim(); password = $password } | ConvertTo-Json -Compress
      $auth = Invoke-RestMethod -Uri ($script:apiBase + "/login") -Method Post -ContentType "application/json" -Body $loginBody -TimeoutSec 30 -ErrorAction Stop
    } catch {
      $failure = Get-UpstreamFailure -ErrorRecord $_
      if ($failure.status -eq 429) {
        $basicSession = @{ authType = "Basic"; username = $username.Trim(); password = $password; token = $null; refresh = $null; client = $null; lastActivity = $now }
        try {
          $basicHeaders = @{ Authorization = (Get-ProviderAuthHeader -Session $basicSession) }
          $details = Invoke-RestMethod -Uri ($script:apiBase + "/details") -Method Get -Headers $basicHeaders -TimeoutSec 30 -ErrorAction Stop
          $basicSession.client = $details.client
          $script:sessions[$SessionId] = $basicSession
          return @{ status = 200; body = @{ authenticated = $true; authType = "Basic" }; cookie = "devhq_session=$SessionId; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800" }
        } catch {
          $basicFailure = Get-UpstreamFailure -ErrorRecord $_
          if ($basicFailure.status -eq 429) {
            return @{ status = 429; body = @{ error = "123HOST đang giới hạn yêu cầu đăng nhập và API tài khoản (HTTP 429). Chờ nhà cung cấp gỡ giới hạn rồi thử lại." } }
          }
          if ($basicFailure.status -eq 401 -or $basicFailure.status -eq 403) {
            return @{ status = $basicFailure.status; body = @{ error = "123HOST đang giới hạn đăng nhập JWT; xác thực Basic dự phòng cũng bị từ chối. Kiểm tra email, mật khẩu và quyền API Basic trong tài khoản." } }
          }
          return @{ status = $basicFailure.status; body = @{ error = $basicFailure.message } }
        }
      }
      return @{ status = $failure.status; body = @{ error = $failure.message } }
    }
    if (-not $auth.token) {
      return @{ status = 502; body = @{ error = "123HOST không trả về mã xác thực. Hãy kiểm tra tài liệu API hoặc liên hệ nhà cung cấp." } }
    }
    $session = @{ authType = "Bearer"; username = $null; password = $null; token = [string]$auth.token; refresh = [string]$auth.refresh; client = $null; lastActivity = $now }
    $script:sessions[$SessionId] = $session
    return @{ status = 200; body = @{ authenticated = $true }; cookie = "devhq_session=$SessionId; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800" }
  }

  if ($Path -eq "/api/logout" -and $Method -eq "POST") {
    $session = $script:sessions[$SessionId]
    $remoteLogoutConfirmed = $true
    if ($session -and $session.token) {
      try {
        Invoke-ProviderRequest -SessionId $SessionId -Method "POST" -Path "/logout" | Out-Null
      } catch {
        $remoteLogoutConfirmed = $false
        Write-Host "123HOST chua xac nhan thu hoi phien dang nhap."
      }
    }
    $script:sessions.Remove($SessionId)
    return @{ status = 200; body = @{ authenticated = $false; remoteLogoutConfirmed = $remoteLogoutConfirmed }; cookie = "devhq_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0" }
  }

  if (-not $script:sessions.ContainsKey($SessionId)) {
    return @{ status = 401; body = @{ error = "Hãy kết nối tài khoản 123HOST trước." } }
  }
  $session = $script:sessions[$SessionId]
  $session.lastActivity = $now
  $script:sessions[$SessionId] = $session

  $providerRoutes = @{
    "/api/123host/details" = @{ path = "/details"; methods = @("GET") }
    "/api/123host/domains" = @{ path = "/domain"; methods = @("GET") }
    "/api/123host/services" = @{ path = "/service"; methods = @("GET") }
    "/api/123host/invoices" = @{ path = "/invoice"; methods = @("GET") }
    "/api/123host/balance" = @{ path = "/balance"; methods = @("GET") }
    "/api/123host/payments" = @{ path = "/payment"; methods = @("GET") }
    "/api/123host/notifications" = @{ path = "/notifications/new"; methods = @("GET") }
  }
  if ($Path -match "^/api/123host/invoices/([0-9]+)$" -and $Method -eq "GET") {
    $invoiceId = $Matches[1]
    return @{ status = 200; body = (Invoke-ProviderRequest -SessionId $SessionId -Method "GET" -Path "/invoice/$invoiceId") }
  }
  if ($Path -match "^/api/123host/domains/([0-9]+)/records/types$" -and $Method -eq "GET") {
    $domainId = $Matches[1]
    return @{ status = 200; body = (Invoke-ProviderRequest -SessionId $SessionId -Method "GET" -Path "/domain/$domainId/dns/types") }
  }
  if ($providerRoutes.ContainsKey($Path) -and $providerRoutes[$Path].methods -contains $Method) {
    $value = Invoke-ProviderRequest -SessionId $SessionId -Method $Method -Path $providerRoutes[$Path].path
    if ($Path -eq "/api/123host/details") {
      $session = $script:sessions[$SessionId]
      $session.client = $value.client
      $script:sessions[$SessionId] = $session
    }
    return @{ status = 200; body = $value }
  }

  if ($Path -match "^/api/123host/notifications/([0-9]+)/ack$" -and $Method -eq "PUT") {
    $notificationId = $Matches[1]
    return @{ status = 200; body = (Invoke-ProviderRequest -SessionId $SessionId -Method "PUT" -Path "/notifications/$notificationId/ack") }
  }

  if ($Path -match "^/api/123host/domains/([0-9]+)(?:/(nameservers|records|renew)(?:/([0-9]+))?)?$") {
    $domainId = $Matches[1]
    $subroute = $Matches[2]
    if (-not $subroute -and $Method -eq "GET") {
      return @{ status = 200; body = (Invoke-ProviderRequest -SessionId $SessionId -Method "GET" -Path "/domain/$domainId") }
    }
    if ($subroute -eq "nameservers" -and $Method -eq "GET") {
      return @{ status = 200; body = (Invoke-ProviderRequest -SessionId $SessionId -Method "GET" -Path "/domain/$domainId/ns") }
    }
    if ($subroute -eq "nameservers" -and $Method -eq "PUT") {
      $body = Read-JsonBody -Request $Request
      if (-not ($body.nameservers -is [array]) -or $body.nameservers.Count -lt 2 -or $body.nameservers.Count -gt 4) {
        return @{ status = 400; body = @{ error = "Nhập từ 2 đến 4 máy chủ tên miền." } }
      }
      $nameservers = @($body.nameservers | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ -match '^(?=.{1,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(\.([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?))+$' })
      if ($nameservers.Count -ne $body.nameservers.Count) {
        return @{ status = 400; body = @{ error = "Một hoặc nhiều máy chủ tên miền không hợp lệ." } }
      }
      $value = Invoke-ProviderRequest -SessionId $SessionId -Method "PUT" -Path "/domain/$domainId/ns" -Parameters @{ nameservers = $nameservers }
      return @{ status = 200; body = $value }
    }
    if ($subroute -eq "records" -and $Method -eq "GET") {
      return @{ status = 200; body = (Invoke-ProviderRequest -SessionId $SessionId -Method "GET" -Path "/domain/$domainId/dns") }
    }
    if ($subroute -eq "records" -and ($Method -eq "POST" -or $Method -eq "PUT")) {
      $body = Read-JsonBody -Request $Request
      $recordName = [string]$body.name
      $recordType = [string]$body.type
      $recordContent = [string]$body.content
      $priority = 0
      if (-not $recordName.Trim() -or $recordName.Length -gt 253 -or -not $recordContent.Trim() -or $recordContent.Length -gt 2048) {
        return @{ status = 400; body = @{ error = "Nhập tên và nội dung bản ghi DNS hợp lệ." } }
      }
      if (@("A", "CNAME", "URL", "FRAME", "MX", "MXE", "TXT") -notcontains $recordType.ToUpperInvariant()) {
        return @{ status = 400; body = @{ error = "Loại bản ghi DNS không được hỗ trợ." } }
      }
      if (-not [int]::TryParse([string]$body.priority, [ref]$priority) -or $priority -lt 0 -or $priority -gt 65535) {
        return @{ status = 400; body = @{ error = "Độ ưu tiên phải nằm trong khoảng 0 đến 65535." } }
      }
      $parameters = @{ name = $recordName.Trim(); type = $recordType.ToUpperInvariant(); content = $recordContent.Trim(); priority = $priority }
      if ($Method -eq "POST") {
        $value = Invoke-ProviderRequest -SessionId $SessionId -Method "POST" -Path "/domain/$domainId/dns" -Parameters $parameters
      } else {
        if ($Request.Url.AbsolutePath -notmatch "^/api/123host/domains/[0-9]+/records/([0-9]+)$") {
          return @{ status = 404; body = @{ error = "Không tìm thấy bản ghi DNS cần cập nhật." } }
        }
        $recordId = $Matches[1]
        $value = Invoke-ProviderRequest -SessionId $SessionId -Method "PUT" -Path "/domain/$domainId/dns/@$recordId" -Parameters $parameters
      }
      return @{ status = 200; body = $value }
    }
    if ($subroute -eq "records" -and $Method -eq "DELETE" -and $Request.Url.AbsolutePath -match "^/api/123host/domains/[0-9]+/records/([0-9]+)$") {
      $recordId = $Matches[1]
      $value = Invoke-ProviderRequest -SessionId $SessionId -Method "DELETE" -Path "/domain/$domainId/dns/@$recordId"
      return @{ status = 200; body = $value }
    }
    if ($subroute -eq "renew" -and $Method -eq "POST") {
      $body = Read-JsonBody -Request $Request
      $years = 0
      $paymentMethod = 0
      if (-not [int]::TryParse([string]$body.years, [ref]$years) -or $years -lt 1 -or $years -gt 10) {
        return @{ status = 400; body = @{ error = "Thời hạn gia hạn phải từ 1 đến 10 năm." } }
      }
      if (-not [int]::TryParse([string]$body.paymentMethod, [ref]$paymentMethod) -or $paymentMethod -lt 1) {
        return @{ status = 400; body = @{ error = "Chọn một phương thức thanh toán hợp lệ." } }
      }
      $value = Invoke-ProviderRequest -SessionId $SessionId -Method "POST" -Path "/domain/$domainId/renew" -Parameters @{ years = $years; pay_method = $paymentMethod }
      return @{ status = 200; body = $value }
    }
  }

  return @{ status = 404; body = @{ error = "Không tìm thấy API này." } }
}

try {
  $listener.Start()
  Write-Host "DevHQ dang chay tai http://127.0.0.1:$Port"
  Write-Host "Giu cua so nay mo. Nhan Ctrl+C de dung may chu."

  while ($listener.IsListening) {
    $context = $listener.GetContext()
    try {
      $request = $context.Request
      $path = $request.Url.AbsolutePath
      $sessionCookie = $request.Cookies["devhq_session"]
      $sessionId = if ($sessionCookie -and $sessionCookie.Value) { $sessionCookie.Value } else { [Guid]::NewGuid().ToString("N") }

      if ($path.StartsWith("/api/", [System.StringComparison]::OrdinalIgnoreCase)) {
        try {
          $result = Get-ApiRoute -SessionId $sessionId -Method $request.HttpMethod.ToUpperInvariant() -Path $path -Request $request -Response $context.Response
          $cookie = if ($result.cookie) { $result.cookie } else { "" }
          Write-JsonResponse -Response $context.Response -StatusCode $result.status -Value $result.body -SetCookie $cookie
        } catch {
          $status = 502
          $message = $_.Exception.Message
          if ($message -eq "Chưa đăng nhập vào tài khoản 123HOST.") {
            $status = 401
          } elseif ($_.Exception.InnerException -and $_.Exception.InnerException.Message -match "^\d+$") {
            $status = [int]$_.Exception.InnerException.Message
          }
          Write-JsonResponse -Response $context.Response -StatusCode $status -Value @{ error = $message }
        }
        $context.Response.Close()
      } else {
        Send-StaticFile -Context $context -RequestPath $path
      }
      Write-Host ("{0} {1} {2}" -f (Get-Date -Format "HH:mm:ss"), $request.HttpMethod, $path)
    } catch {
      Write-Host ("Yeu cau bi loi: {0}" -f $_.Exception.Message)
      try { $context.Response.Close() } catch { }
    }
  }
} finally {
  if ($listener.IsListening) {
    $listener.Stop()
  }
  $listener.Close()
}
