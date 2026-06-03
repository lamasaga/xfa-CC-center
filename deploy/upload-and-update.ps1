<#
.SYNOPSIS
    一键：本机打包 app 源码（不含 node_modules/dist/库文件）→ SCP 上传 → SSH 在服务器解压并 npm 构建 → 重启 alevelinfo。

.DESCRIPTION
    在 Windows PowerShell 中于「仓库根目录」或任意目录执行均可；脚本通过 $PSScriptRoot 定位 app。

    前置：本机已安装 OpenSSH 客户端（ssh/scp）、服务器已配置 SSH 密钥或密码登录；
         当前 SSH 用户需能 sudo systemctl restart alevelinfo（一般为 ubuntu 免密或手动输密码）。
    若平时使用 ssh -i 指定私钥，请传入 -IdentityFile，或在本机 ~/.ssh/config 中为该主机配置 IdentityFile。

.Example
    .\deploy\upload-and-update.ps1 -Server "1.2.3.4"
    .\deploy\upload-and-update.ps1 -Server "your.host" -User ubuntu -RemoteAppPath "/opt/alevelinfo/app"
    .\deploy\upload-and-update.ps1 -Server "42.193.112.229" -IdentityFile "$env:USERPROFILE\.ssh\alevelinfo_ed25519"
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $Server,

    [string] $User = "ubuntu",

    [string] $RemoteAppPath = "/opt/alevelinfo/app",

    [string] $ServiceName = "alevelinfo",

    [string] $IdentityFile = ""
)

$ErrorActionPreference = "Stop"

$SshScpArgs = @()
if (-not [string]::IsNullOrWhiteSpace($IdentityFile)) {
    if (-not (Test-Path -LiteralPath $IdentityFile)) {
        Write-Error "找不到 SSH 私钥: $IdentityFile"
    }
    $SshScpArgs = @("-i", $IdentityFile)
}

$DeployDir = $PSScriptRoot
$RepoRoot = Split-Path -Parent $DeployDir
$LocalApp = Join-Path $RepoRoot "app"

if (-not (Test-Path -LiteralPath $LocalApp)) {
    Write-Error "找不到本地 app 目录: $LocalApp"
}

$StudyApp = Join-Path $RepoRoot "study-app"
if (-not (Test-Path -LiteralPath $StudyApp)) {
    Write-Error "找不到 study-app 目录: $StudyApp"
}

$StudyDist = Join-Path $LocalApp "study-dist"
Write-Host "==> 构建院校探索站: $StudyApp"
Push-Location $StudyApp
try {
    npm ci
    npm run build
}
finally {
    Pop-Location
}

$StudyBuild = Join-Path $StudyApp "dist"
if (-not (Test-Path -LiteralPath $StudyBuild)) {
    Write-Error "study-app 构建失败，未找到 dist"
}

Write-Host "==> 同步 study-app/dist -> $StudyDist"
if (Test-Path -LiteralPath $StudyDist) {
    Remove-Item -LiteralPath $StudyDist -Recurse -Force
}
Copy-Item -Path $StudyBuild -Destination $StudyDist -Recurse

$TarName = "alevelinfo-deploy.tgz"
$TarPath = Join-Path $env:TEMP $TarName

Write-Host "==> 打包: $LocalApp -> $TarPath"
Push-Location $LocalApp
try {
    if (Test-Path -LiteralPath $TarPath) { Remove-Item -LiteralPath $TarPath -Force }
    # Windows 自带 tar：排除依赖与产物，避免覆盖服务器上的 SQLite
    tar.exe -czf $TarPath `
        --exclude=node_modules `
        --exclude=dist `
        --exclude=database.sqlite `
        --exclude=database.sqlite-wal `
        --exclude=database.sqlite-shm `
        --exclude=uploads `
        --exclude=.env `
        --exclude=.env.* `
        --exclude=.git `
        .
}
finally {
    Pop-Location
}

if (-not (Test-Path -LiteralPath $TarPath)) {
    Write-Error "打包失败: $TarPath"
}

$RemoteTar = "/tmp/alevelinfo-deploy.tgz"
$RemoteScript = "/tmp/alevelinfo-remote-update.sh"
$LocalScript = Join-Path $DeployDir "remote-update.sh"

if (-not (Test-Path -LiteralPath $LocalScript)) {
    Write-Error "找不到远程脚本: $LocalScript"
}

Write-Host "==> 上传压缩包与脚本 -> ${User}@${Server}"
scp.exe @SshScpArgs -o StrictHostKeyChecking=accept-new $TarPath "${User}@${Server}:${RemoteTar}"
scp.exe @SshScpArgs -o StrictHostKeyChecking=accept-new $LocalScript "${User}@${Server}:${RemoteScript}"

Write-Host "==> 在服务器执行更新（会 stop → 解压 → npm → start）"
# Windows PowerShell 5.1：源码里若出现未被正确配对的 "，会把 && 误解析为语句分隔符；用单引号拼接避免 && 出现在双引号字面量中
$remoteCmd = 'chmod +x /tmp/alevelinfo-remote-update.sh && APP=' + $RemoteAppPath + ' TAR=' + $RemoteTar + ' SERVICE_NAME=' + $ServiceName + ' bash /tmp/alevelinfo-remote-update.sh'
# 远端 bash -lc 用单引号包住整段命令，避免本地再嵌套双引号转义
$sshResult = 0
ssh.exe @SshScpArgs "${User}@${Server}" "bash -lc '$remoteCmd'"
$sshResult = $LASTEXITCODE
if ($sshResult -ne 0) {
    Write-Error "远端更新失败（ssh 退出码 $sshResult），请登录服务器查看 journalctl / systemctl status。"
}

Write-Host "==> 本机临时包可删: $TarPath"
Remove-Item -LiteralPath $TarPath -Force -ErrorAction SilentlyContinue

Write-Host "==> 全部完成。"
