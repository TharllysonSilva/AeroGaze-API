$ErrorActionPreference = 'Stop'
$webSourceRoot = 'E:\TyCoders\AeroGaze IA\files\aerogaze-web\aerogaze-web'
$apiRepositoryRoot = Split-Path -Parent $PSScriptRoot
$webPublishRoot = Join-Path $apiRepositoryRoot 'web'
New-Item -ItemType Directory -Path $webPublishRoot -Force | Out-Null
# Lista explícita: nunca copia .env, node_modules, .next, logs ou credenciais.
foreach ($webDirectory in @('app','components','lib','scripts','styles','test','public')) {
  Copy-Item -LiteralPath (Join-Path $webSourceRoot $webDirectory) -Destination $webPublishRoot -Recurse -Force
}
foreach ($webFile in @('package.json','package-lock.json','tsconfig.json','next.config.mjs','postcss.config.mjs','tailwind.config.ts','middleware.ts','Dockerfile','.dockerignore','.gitignore','.env.example','README.md')) {
  Copy-Item -LiteralPath (Join-Path $webSourceRoot $webFile) -Destination (Join-Path $webPublishRoot $webFile) -Force
}
Write-Output 'Fontes da web preparadas em web/; arquivos de ambiente privados não foram copiados.'
