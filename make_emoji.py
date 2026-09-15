"""Эмодзи-пак Telegram с логотипами команд.

Делает из assets/logos/*.png картинки ровно 100×100 с прозрачным фоном (требование Telegram
к custom emoji) в assets/emoji/ и список assets/emoji/pack.json. Сам пак создаёт бот командой
/emojipack (см. bot/worker/worker.js): он берёт картинки по ссылкам с GitHub, поэтому после
запуска скрипта папку assets/emoji нужно закоммитить и запушить.

Запуск из папки tool:  python make_emoji.py
Команды берутся из teams.json, плюс логотип Iron Hearts Bois (assets/logos/ihb.png).
"""
import json
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "assets", "emoji")
SIZE = 100

# ключевые слова для поиска в панели эмодзи (Telegram: не больше 64 символов на все вместе)
KEYWORDS = {
    "iron_hearts_bois": ["ihb", "bois", "бойс"],
    "miljakovac": ["miljakovac", "миляковац"],
    "city_sport": ["city sport", "сити"],
    "hajduk": ["hajduk", "хайдук"],
    "palilulac": ["palilulac", "палилулац"],
    "omladinac_1961": ["omladinac", "омладинац"],
    "pkb_kovilovo": ["kovilovo", "ковилово"],
    "resnik": ["resnik", "ресник"],
    "ufk_studentski_grad_pu3r": ["studentski grad", "студентски"],
}


def make_one(src, dst):
    im = Image.open(src).convert("RGBA")
    bbox = im.getchannel("A").getbbox()  # обрезаем прозрачные поля
    if bbox:
        im = im.crop(bbox)
    im.thumbnail((SIZE, SIZE), Image.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.alpha_composite(im, ((SIZE - im.width) // 2, (SIZE - im.height) // 2))
    canvas.save(dst, optimize=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(HERE, "teams.json"), encoding="utf-8") as f:
        teams = json.load(f)
    items = [("iron_hearts_bois", "Iron Hearts Bois", os.path.join(HERE, "assets", "logos", "ihb.png"), "💚")]
    for t in teams:
        items.append((t["id"], t["sr"], os.path.join(HERE, "assets", "logos", t["logo"]), "⚽"))
    pack = {"version": 1, "title": "Iron Hearts Bois — клубы", "items": []}
    old = os.path.join(OUT, "pack.json")
    if os.path.exists(old):
        with open(old, encoding="utf-8") as f:
            pack["version"] = int(json.load(f).get("version", 0)) + 1  # чтобы Telegram не взял старую картинку из кэша
    for tid, name, src, emoji in items:
        if not os.path.exists(src):
            print("нет логотипа:", src)
            continue
        make_one(src, os.path.join(OUT, tid + ".png"))
        kw = KEYWORDS.get(tid, [name.lower()])
        pack["items"].append({"id": tid, "name": name, "file": tid + ".png", "emoji": emoji, "keywords": kw})
        print(f"{tid:28s} {name}")
    with open(old, "w", encoding="utf-8") as f:
        json.dump(pack, f, ensure_ascii=False, indent=2)
    print(f"готово: {len(pack['items'])} эмодзи, версия {pack['version']} → {OUT}")


if __name__ == "__main__":
    main()
