# Waits until EasyDispatch answers, then opens the login page.
$url = 'http://localhost:3000/login'
for ($i = 0; $i -lt 90; $i++) {
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
    if ($r.StatusCode -eq 200) {
      Start-Process $url
      exit 0
    }
  } catch {
    # not ready yet
  }
  Start-Sleep -Seconds 1
}
# Last resort: open anyway
Start-Process $url
