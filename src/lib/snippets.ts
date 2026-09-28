// Copy-paste automation recipes, filled in with this node's address (and a fresh token when
// the admin just created one). Mirrors spec docs/automation.md.

export interface Snippet {
  id: 'cli' | 'watch' | 'cron' | 'windows' | 'github' | 'curl' | 'http'
  lang: string
  code: string
}

export function automationSnippets(nodeUrl: string, token?: string): Snippet[] {
  const url = nodeUrl.replace(/\/+$/, '')
  const tok = token || 'obxi_…'
  const ingest = `${url}/obx/v1/ingest`
  return [
    {
      id: 'cli',
      lang: 'sh',
      code: `export OBX_URL=${url}
export OBX_TOKEN=${tok}
obx info                                          # check the token
obx push --csv products.csv --images ./images     # publish (only changed images are uploaded)
obx push --package export.zip --dry-run           # check a zip without changing anything`,
    },
    {
      id: 'watch',
      lang: 'sh',
      code: `docker run -d --restart unless-stopped \\
  -e OBX_URL=${url} -e OBX_TOKEN=${tok} \\
  -v /data/outbox:/outbox ghcr.io/openbrandexchange/obx watch /outbox`,
    },
    {
      id: 'cron',
      lang: 'cron',
      code: `# crontab -e  (every night at 02:30)
30 2 * * * OBX_URL=${url} OBX_TOKEN=${tok} /usr/local/bin/obx push --csv /exports/products.csv --images /exports/images >> /var/log/obx.log 2>&1`,
    },
    {
      id: 'windows',
      lang: 'powershell',
      code: `$action  = New-ScheduledTaskAction -Execute "C:\\Tools\\obx.exe" -Argument "push --csv D:\\Export\\products.csv --images D:\\Export\\images"
$trigger = New-ScheduledTaskTrigger -Daily -At 2:30am
[Environment]::SetEnvironmentVariable("OBX_URL", "${url}", "Machine")
[Environment]::SetEnvironmentVariable("OBX_TOKEN", "${tok}", "Machine")
Register-ScheduledTask -TaskName "Publish to OBX" -Action $action -Trigger $trigger -User "SYSTEM"`,
    },
    {
      id: 'github',
      lang: 'yaml',
      code: `# .github/workflows/publish.yml  (add secrets OBX_URL=${url} and OBX_TOKEN)
name: Publish product content
on:
  push: { branches: [main], paths: ["export/**"] }
  schedule: [{ cron: "30 2 * * *" }]
  workflow_dispatch:
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install obx
        run: |
          curl -fsSL https://github.com/openbrandexchange/obx-go/releases/latest/download/obx_linux_amd64.tar.gz | tar -xz obx
          sudo mv obx /usr/local/bin/
      - name: Publish
        env:
          OBX_URL: \${{ secrets.OBX_URL }}
          OBX_TOKEN: \${{ secrets.OBX_TOKEN }}
        run: obx push --csv export/products.csv --images export/images`,
    },
    {
      id: 'curl',
      lang: 'sh',
      code: `curl -s -X POST -H "Authorization: Bearer ${tok}" \\
  -F csv=@products.csv -F images=@images.zip \\
  -F 'options={"mode":"upsert"};type=application/json' \\
  ${ingest}/imports`,
    },
    {
      id: 'http',
      lang: 'http',
      code: `PUT ${ingest}/products/KO-1001
Authorization: Bearer ${tok}
Content-Type: application/json

{"style_number": "KO-1001", "name": {"en": "Merino Crew Sweater", "nl": "Merino trui"}}`,
    },
  ]
}
