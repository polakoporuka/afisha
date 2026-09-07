# -*- coding: utf-8 -*-
"""
Сборщик ассетов для инструмента афиш.

Что делает:
  1. Читает teams.json, assets/logos/*.png, assets/bg/*.jpg, assets/fonts/*
  2. Упаковывает всё в assets/data.js в виде base64 (нужно, чтобы инструмент
     работал прямо с диска по file:// и мог экспортировать PNG без запрета браузера).
  3. Собирает одиночный файл dist/afisha.html, в который встроено вообще всё
     (удобно кидать на телефон или пересылать).

Запуск:  python build_assets.py
Требуется только стандартный Python 3 (без сторонних библиотек).
"""
import base64
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "assets")

MIME = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".otf": "font/otf",
    ".ttf": "font/ttf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
}


def data_url(path):
    ext = os.path.splitext(path)[1].lower()
    with open(path, "rb") as f:
        b = f.read()
    return "data:%s;base64,%s" % (MIME.get(ext, "application/octet-stream"), base64.b64encode(b).decode("ascii"))


def build_data_js():
    fonts = {
        "Kino": data_url(os.path.join(ASSETS, "fonts", "Kino-Regular.otf")),
        "Maler": data_url(os.path.join(ASSETS, "fonts", "Maler.ttf")),
    }
    bgs = {}
    for name in ("next_1x1", "next_9x16", "score_1x1", "score_9x16"):
        for ext in (".jpg", ".png"):
            p = os.path.join(ASSETS, "bg", name + ext)
            if os.path.exists(p):
                bgs[name] = data_url(p)
                break
        else:
            sys.exit("Нет фона assets/bg/%s.jpg" % name)

    with open(os.path.join(HERE, "teams.json"), encoding="utf-8") as f:
        teams = json.load(f)
    out_teams = []
    for t in teams:
        logo_path = os.path.join(ASSETS, "logos", t["logo"])
        if not os.path.exists(logo_path):
            print("ВНИМАНИЕ: нет логотипа", logo_path, "— команда пропущена")
            continue
        out_teams.append({
            "id": t["id"],
            "ru": t.get("ru", ""),
            "sr": t.get("sr", ""),
            "logo": data_url(logo_path),
            "scale": float(t.get("scale", 1)),
            "stadium_ru": t.get("stadium_ru", ""),
            "stadium_sr": t.get("stadium_sr", ""),
        })

    payload = {"fonts": fonts, "bgs": bgs, "teams": out_teams}
    js = "// Сгенерировано build_assets.py — не редактировать руками.\nwindow.AFISHA_ASSETS = " + json.dumps(payload, ensure_ascii=False) + ";\n"
    out = os.path.join(ASSETS, "data.js")
    with open(out, "w", encoding="utf-8") as f:
        f.write(js)
    print("assets/data.js: %.1f МБ, команд: %d" % (os.path.getsize(out) / 1e6, len(out_teams)))


def build_single_html():
    with open(os.path.join(HERE, "index.html"), encoding="utf-8") as f:
        html = f.read()

    def read(rel):
        p = os.path.join(HERE, rel)
        if not os.path.exists(p):
            return None
        with open(p, encoding="utf-8") as f:
            return f.read()

    def css_repl(m):
        css = read(m.group(1))
        return "<style>\n%s\n</style>" % css if css is not None else ""

    def js_repl(m):
        js = read(m.group(1))
        if js is None:
            return ""
        js = js.replace("</script>", "<\\/script>")
        return "<script>\n%s\n</script>" % js

    html = re.sub(r'<link[^>]+href="([^"]+\.css)"[^>]*>', css_repl, html)
    html = re.sub(r'<script[^>]+src="([^"]+\.js)"[^>]*></script>', js_repl, html)
    dist = os.path.join(HERE, "dist")
    os.makedirs(dist, exist_ok=True)
    out = os.path.join(dist, "afisha.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    print("dist/afisha.html: %.1f МБ" % (os.path.getsize(out) / 1e6))


if __name__ == "__main__":
    build_data_js()
    build_single_html()
