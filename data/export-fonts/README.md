# Offline export font

`NotoSansCJKsc-Regular.otf` is the Noto CJK Simplified Chinese regular font from
https://github.com/notofonts/noto-cjk/tree/main/Sans/OTF/SimplifiedChinese.
Its SIL Open Font License is retained in `OFL.txt`.

The CLI registers this bundled font for Chinese export text so offline ZIP watermarks,
PDF and PNG do not depend on an operating system's installed CJK fonts.

`ComicNeue-Bold.ttf` is the unmodified Comic Neue Bold font from
[Google Fonts](https://github.com/google/fonts/tree/main/ofl/comicneue), by the
[Comic Neue project](https://github.com/crozynski/comicneue). Its copyright notice
and SIL Open Font License 1.1 are retained in `ComicNeue-OFL.txt`. The file's SHA256
is `3e7e5fccfd7e0788f317b43312151c1bd5cf058c9697a8d83eac3939050bd61e`.
The browser and native renderer load this same file locally as `Shiqu Comic`.
Shared advance widths come from its original Unicode cmap and hmtx tables.

The complete Comic Neue copyright and OFL text is also included in the root `NOTICE`, which ships with both desktop and npm distributions. The browser font asset therefore travels with its licence without adding a network request.
