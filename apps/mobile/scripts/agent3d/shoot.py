"""Render scene.html views to PNG with headless Chromium (software WebGL)."""
import asyncio
import functools
import http.server
import sys
import threading

from playwright.async_api import async_playwright

ROOT = __import__("os").path.dirname(__import__("os").path.abspath(__file__))


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    handler.log_message = lambda *a, **k: None
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv.server_address[1]


async def main(shots):
    port = serve()
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        for view, w, h, out in shots:
            pg = await b.new_page(viewport={"width": w, "height": h})
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            await pg.goto(f"http://127.0.0.1:{port}/{view}&w={w}&h={h}")
            try:
                await pg.wait_for_function("window.__done === true", timeout=120000)
            except Exception as e:
                print("timeout", view, errs[:3], e)
                continue
            await pg.screenshot(path=out, omit_background=True)
            print("wrote", out, errs[:2])
            await pg.close()
        await b.close()


if __name__ == "__main__":
    shots = [a.split("@") for a in sys.argv[1:]]
    asyncio.run(main([(v, int(w), int(h), o) for v, w, h, o in shots]))
