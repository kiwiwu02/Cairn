#!/usr/bin/env python3
"""学习工作台的 macOS / VS Code 本地桥接服务。

网页本身无法从 File System Access API 得到用户选择目录的绝对路径，
也不能直接执行系统命令。因此这个服务默认只绑定本机回环地址：打开本地文件夹
时由 macOS 原生选择器确定根目录，网页通过本服务读取文件和学习状态，
并在需要时调用 VS Code 打开文件。
"""

from __future__ import annotations

import argparse
import ipaddress
import json
import mimetypes
import os
import subprocess
import sys
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit


BRIDGE_VERSION = "1.3"
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 4317
LOOPBACK_HOSTS = {"127.0.0.1", "localhost", "::1"}
STATE_FILE = ".cairn-workspace.json"
LEGACY_STATE_FILE = ".learning-workspace.json"
STATE_FILES = (STATE_FILE, LEGACY_STATE_FILE)
IGNORED_DIRECTORIES = {".git", "node_modules", "dist", "build", ".cache", ".next", ".vite"}
MAX_WORKSPACE_BYTES = 4 * 1024 * 1024
MAX_FILE_BYTES = 100 * 1024 * 1024
# 默认不放行任何远程站点：本地打开能力只交给本机页面。
# 需要让线上部署联动 VS Code 时，由使用者显式用 --allow-origin 加自己的域名，
# 因此这里保持为空，不内置任何演示或托管域名。
REMOTE_ALLOWED_ORIGINS: frozenset[str] = frozenset()


def is_loopback_host(host: str) -> bool:
    if host.casefold() == "localhost":
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def normalize_origin(origin: str) -> str | None:
    """把 Origin 规范化为 scheme://host[:port]；带路径、查询或凭据的一律视为非法。"""
    parsed = urlsplit(origin)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return None
    if parsed.path not in {"", "/"} or parsed.query or parsed.fragment:
        return None
    if parsed.username or parsed.password:
        return None
    try:
        port = parsed.port
    except ValueError:
        return None
    host = parsed.hostname
    # IPv6 来源需要保留方括号，否则和浏览器发送的 Origin 对不上。
    if ":" in host and not host.startswith("["):
        host = f"[{host}]"
    default_port = 443 if parsed.scheme == "https" else 80
    if port is None or port == default_port:
        return f"{parsed.scheme}://{host}"
    return f"{parsed.scheme}://{host}:{port}"


def allowed_origin(origin: str | None, allowed_origins: frozenset[str] = REMOTE_ALLOWED_ORIGINS) -> bool:
    """放行本机页面；远程页面必须精确命中白名单，避免把本地打开能力暴露给任意网站。"""
    if not origin:
        return True
    normalized = normalize_origin(origin)
    if normalized is None:
        return False
    hostname = urlsplit(normalized).hostname or ""
    if hostname in LOOPBACK_HOSTS:
        return True
    # 完整字符串相等比较，不做前缀或包含匹配，防止 https://白名单域名.evil.com 蒙混过关。
    return normalized in {normalize_origin(item) or "" for item in allowed_origins}


def safe_path(root: Path, relative: object) -> Path:
    """把网页传来的相对路径安全地解析到根目录内。"""
    if not isinstance(relative, str):
        raise ValueError("缺少有效文件路径")
    value = relative.strip().replace("\\", "/")
    if not value or value.startswith("/") or "\x00" in value:
        raise ValueError("文件路径必须是有效的相对路径")

    parts = [part for part in value.split("/") if part]
    if not parts or any(part in {".", ".."} for part in parts):
        raise ValueError("不允许访问根目录之外的路径")

    target = (root.joinpath(*parts)).resolve()
    try:
        target.relative_to(root)
    except ValueError as error:
        raise ValueError("不允许访问根目录之外的路径") from error
    return target


def open_in_vscode(root: Path, target: Path) -> str:
    """优先使用 code 命令，macOS 上回退到 Visual Studio Code 应用。"""
    try:
        subprocess.Popen(
            ["code", "--reuse-window", "--goto", str(target)],
            cwd=str(root),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        return "code"
    except FileNotFoundError:
        if sys.platform != "darwin":
            raise RuntimeError("找不到 VS Code 的 code 命令")

    try:
        subprocess.run(
            ["open", "-a", "Visual Studio Code", str(target)],
            check=True,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError) as error:
        raise RuntimeError("找不到 Visual Studio Code，请先安装 VS Code") from error
    return "open"


def choose_root_on_macos() -> Path:
    """通过 macOS 原生目录选择器，让用户绑定任意本地文件夹。"""
    script = 'POSIX path of (choose folder with prompt "选择要绑定到 VS Code 的本地目录")'
    try:
        result = subprocess.run(
            ["osascript", "-e", script],
            check=True,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as error:
        raise RuntimeError("找不到 macOS 目录选择器，请使用 --root 指定目录") from error
    except subprocess.CalledProcessError as error:
        raise RuntimeError("已取消目录选择") from error

    selected = Path(result.stdout.strip()).expanduser().resolve()
    if not selected.is_dir():
        raise RuntimeError(f"选择的路径不是文件夹：{selected}")
    return selected


def scan_files(root: Path) -> list[dict[str, object]]:
    """返回根目录内的文件清单，不跟随符号链接目录。"""
    files: list[dict[str, object]] = []

    def visit(directory: Path) -> None:
        try:
            children = sorted(directory.iterdir(), key=lambda item: item.name.casefold())
        except OSError as error:
            raise RuntimeError(f"无法读取目录：{directory.name}") from error
        for child in children:
            if child.name in STATE_FILES or child.name.startswith("."):
                continue
            if child.is_symlink():
                continue
            if child.is_dir():
                if child.name in IGNORED_DIRECTORIES:
                    continue
                visit(child)
            elif child.is_file():
                try:
                    relative = child.relative_to(root).as_posix()
                    stat = child.stat()
                except OSError as error:
                    raise RuntimeError(f"无法读取文件：{child.name}") from error
                files.append(
                    {
                        "name": child.name,
                        "path": relative,
                        "size": stat.st_size,
                        "modifiedAt": stat.st_mtime,
                    }
                )

    visit(root)
    return files


def read_workspace(root: Path) -> dict[str, object]:
    for file_name in STATE_FILES:
        state_path = root / file_name
        try:
            if not state_path.exists():
                continue
            if state_path.stat().st_size > MAX_WORKSPACE_BYTES:
                raise RuntimeError("学习状态文件过大，暂时无法读取")
            with state_path.open("r", encoding="utf-8") as stream:
                payload = json.load(stream)
            return payload if isinstance(payload, dict) else {}
        except json.JSONDecodeError as error:
            raise RuntimeError("学习状态文件格式损坏，请先备份后处理") from error
    return {}


def write_workspace(root: Path, payload: object) -> None:
    if not isinstance(payload, dict):
        raise ValueError("学习状态内容无效")
    serialized = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    if len(serialized.encode("utf-8")) > MAX_WORKSPACE_BYTES:
        raise ValueError("学习状态文件过大，无法保存")
    state_path = root / STATE_FILE
    legacy_path = root / LEGACY_STATE_FILE
    temporary_path = root / f"{STATE_FILE}.tmp"
    try:
        with temporary_path.open("w", encoding="utf-8") as stream:
            stream.write(serialized)
        os.replace(temporary_path, state_path)
        if legacy_path != state_path:
            try:
                legacy_path.unlink()
            except FileNotFoundError:
                pass
            except OSError:
                # 新文件已经安全写入；旧文件清理失败不应让本次保存失败。
                pass
    except OSError as error:
        try:
            temporary_path.unlink(missing_ok=True)
        except OSError:
            pass
        raise RuntimeError("学习状态文件保存失败") from error


class BridgeServer(ThreadingHTTPServer):
    allow_reuse_address = True

    def __init__(self, address: tuple[str, int], root: Path, allowed_origins: frozenset[str] = REMOTE_ALLOWED_ORIGINS):
        self.root = root.resolve()
        self.allowed_origins = allowed_origins
        super().__init__(address, Handler)


class Handler(BaseHTTPRequestHandler):
    server: BridgeServer
    server_version = "LearningWorkspaceVSCodeBridge/1.3"

    def log_message(self, format: str, *args: object) -> None:
        return

    def request_origin(self) -> str | None:
        return self.headers.get("Origin")

    def is_allowed_origin(self, origin: str | None) -> bool:
        return allowed_origin(origin, self.server.allowed_origins)

    def cors_origin_header(self) -> str | None:
        """仅在来源命中白名单时回显 CORS 头。"""
        origin = self.request_origin()
        return origin if origin and self.is_allowed_origin(origin) else None

    def send_json(self, payload: dict, status: int = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        allowed = self.cors_origin_header()
        if allowed:
            self.send_header("Access-Control-Allow-Origin", allowed)
            self.send_header("Vary", "Origin")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def origin_is_allowed(self) -> bool:
        origin = self.request_origin()
        if self.is_allowed_origin(origin):
            return True
        self.send_json(
            {
                "error": "只允许本机网页或白名单站点调用 VS Code 打开助手",
                "hint": "需要远程站点接入时，重启桥接服务并追加 --allow-origin https://你的域名",
                "origin": origin,
            },
            HTTPStatus.FORBIDDEN,
        )
        return False

    def read_json(self) -> dict:
        return self._read_json_with_limit(64 * 1024)

    def _read_json_with_limit(self, max_bytes: int) -> dict:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError as error:
            raise ValueError("请求内容长度无效") from error
        if length <= 0 or length > max_bytes:
            raise ValueError("请求内容无效")
        payload = json.loads(self.rfile.read(length).decode("utf-8"))
        if not isinstance(payload, dict):
            raise ValueError("请求内容必须是对象")
        return payload

    def send_file(self, target: Path) -> None:
        try:
            size = target.stat().st_size
        except OSError as error:
            raise FileNotFoundError("文件不存在，可能已被移动或删除") from error
        if size > MAX_FILE_BYTES:
            raise ValueError("文件超过 100 MB，暂不支持网页预览")
        body = target.read_bytes()
        self.send_response(HTTPStatus.OK)
        allowed = self.cors_origin_header()
        if allowed:
            self.send_header("Access-Control-Allow-Origin", allowed)
            self.send_header("Vary", "Origin")
        content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        if not self.origin_is_allowed():
            return
        self.send_response(HTTPStatus.NO_CONTENT)
        allowed = self.cors_origin_header()
        if allowed:
            self.send_header("Access-Control-Allow-Origin", allowed)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        if not self.origin_is_allowed():
            return
        try:
            parsed = urlsplit(self.path)
            path = parsed.path
            if path == "/api/health":
                self.send_json(
                    {
                        "ok": True,
                        "version": BRIDGE_VERSION,
                        "rootName": self.server.root.name,
                    }
                )
                return
            if path == "/api/tree":
                self.send_json(
                    {
                        "ok": True,
                        "rootName": self.server.root.name,
                        "files": scan_files(self.server.root),
                    }
                )
                return
            if path == "/api/workspace":
                self.send_json({"ok": True, "workspace": read_workspace(self.server.root)})
                return
            if path == "/api/file":
                relative = parse_qs(parsed.query).get("path", [""])[0]
                target = safe_path(self.server.root, relative)
                if not target.is_file():
                    raise FileNotFoundError("文件不存在，可能已被移动或删除")
                self.send_file(target)
                return
            self.send_json({"error": "接口不存在"}, HTTPStatus.NOT_FOUND)
        except (ValueError, FileNotFoundError, RuntimeError) as error:
            self.send_json({"error": str(error)}, HTTPStatus.BAD_REQUEST)
        except Exception as error:  # pragma: no cover - 本地服务兜底
            self.send_json({"error": f"服务错误：{error}"}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def do_POST(self) -> None:
        if not self.origin_is_allowed():
            return
        try:
            path = urlsplit(self.path).path
            if path == "/api/select-root":
                if sys.platform != "darwin":
                    raise RuntimeError("当前系统暂不支持通过系统选择器切换目录，请重启时使用 --root")
                self.server.root = choose_root_on_macos().resolve()
                self.send_json(
                    {
                        "ok": True,
                        "rootName": self.server.root.name,
                    }
                )
                return
            if path == "/api/workspace":
                payload = self._read_json_with_limit(MAX_WORKSPACE_BYTES)
                write_workspace(self.server.root, payload.get("workspace"))
                self.send_json({"ok": True})
                return
            if path != "/api/open":
                self.send_json({"error": "接口不存在"}, HTTPStatus.NOT_FOUND)
                return

            payload = self.read_json()
            target = safe_path(self.server.root, payload.get("path"))
            if not target.is_file():
                raise FileNotFoundError("文件不存在，可能已被移动或删除")
            opened_by = open_in_vscode(self.server.root, target)
            self.send_json({"ok": True, "openedBy": opened_by})
        except (ValueError, FileNotFoundError, RuntimeError) as error:
            self.send_json({"error": str(error)}, HTTPStatus.BAD_REQUEST)
        except Exception as error:  # pragma: no cover - 本地服务兜底
            self.send_json({"error": f"服务错误：{error}"}, HTTPStatus.INTERNAL_SERVER_ERROR)


def main() -> None:
    parser = argparse.ArgumentParser(description="学习工作台 VS Code 本地打开助手")
    parser.add_argument(
        "--root",
        help="启动时默认绑定的本地文件夹绝对路径；不传时 macOS 会弹出目录选择器",
    )
    parser.add_argument("--host", default=DEFAULT_HOST, help="监听地址，仅允许本机回环地址")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="监听端口，默认 4317")
    parser.add_argument(
        "--allow-origin",
        action="append",
        default=None,
        metavar="ORIGIN",
        help="追加允许调用本服务的远程站点，例如 https://example.com；可重复，也支持逗号分隔",
    )
    parser.add_argument(
        "--no-remote",
        action="store_true",
        help="强制关闭全部远程来源（连 --allow-origin 也忽略），只允许本机页面调用",
    )
    args = parser.parse_args()

    if args.root:
        root = Path(os.path.expanduser(args.root)).resolve()
        if not root.is_dir():
            parser.error(f"根目录不存在或不是文件夹：{root}")
    else:
        if sys.platform != "darwin":
            parser.error("非 macOS 系统请使用 --root 指定目录")
        try:
            root = choose_root_on_macos()
        except RuntimeError as error:
            parser.error(str(error))

    if not is_loopback_host(args.host):
        parser.error("VS Code 助手只允许监听本机回环地址")

    if args.no_remote:
        remote_origins: frozenset[str] = frozenset()
    else:
        extra = [item.strip() for value in (args.allow_origin or []) for item in value.split(",")]
        invalid = [item for item in extra if item and normalize_origin(item) is None]
        if invalid:
            parser.error(
                "--allow-origin 需要完整的 scheme://host[:port]，不能带路径或通配符：" + "、".join(invalid)
            )
        remote_origins = frozenset(
            {*[normalize_origin(o) for o in extra if o], *[normalize_origin(o) for o in REMOTE_ALLOWED_ORIGINS]}
        )

    server = BridgeServer((args.host, args.port), root, remote_origins)
    print(f"学习工作台 VS Code 助手已启动：http://{args.host}:{args.port}", flush=True)
    print(f"绑定目录：{root}", flush=True)
    if remote_origins:
        print("放行的远程站点：" + "、".join(sorted(remote_origins)), flush=True)
    else:
        print("远程站点：已全部关闭，仅本机页面可调用", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nVS Code 助手已停止", flush=True)
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
