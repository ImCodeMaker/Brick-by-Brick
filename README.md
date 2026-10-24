# Brick by Brick

An unofficial, kid-friendly guide to the Roblox Engine API, with plain-words explanations, examples, interactive labs and the Creator Hub guides. Not made by or affiliated with Roblox.

## Layout

- `site/` is the deployable static site (open `index.html`, no server code).
- `build.py` builds the API reference data in `site/data` from the Roblox creator-docs YAML.
- `build_guides.py` builds the guide pages in `site/data/g` from `gsrc/` (pages listed in `guide_pages.txt`).
- `serve.py` serves `site/` locally with caching off.
- `test/` holds jsdom checks (`cd test && npm install`).

## Build

```sh
git clone --depth 1 https://github.com/Roblox/creator-docs src/creator-docs
pip install pyyaml markdown
python3 build.py
python3 build_guides.py
```

## Run locally

```sh
python3 serve.py   # then open http://127.0.0.1:8765/
```

## Deploy

`site/` is plain static files. On Cloudflare Pages, connect this repo with no build command and `site` as the output directory.

## License

The code in this repo is under the MIT License (`LICENSE`). Reference text, guide text and media from the [Roblox Creator Docs](https://github.com/Roblox/creator-docs) are under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), with changes and additions made here.
