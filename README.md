# 蛋的大發現

給小朋友和家長看的雞蛋小網站，用 GitHub Pages 發布。

| 頁面 | 內容 |
|---|---|
| `index.html` | 從蛋到小雞：為什麼超市的蛋不會孵出小雞、21 天孵化時間軸、雞蛋剖面圖、小測驗 |
| `chickens.html` | 雞的祕密（全文注音）：雞的身體、雞沒有牙齒、雞會用叫聲說話、雞是恐龍的親戚。由 `src/chickens.src.html` 產生 |
| `farming.html` | 飼養方式：重點是蛋殼上的字母（O/F/B/E/C），可點選的蛋殼和五種雞媽媽的家，加上營養、動物福利比較 |
| `taiwan-data.html` | 舊網址（台灣養雞數據頁已移除，對小朋友太難），自動轉到 `index.html` |
| `buy-eggs.html` | 哪裡買雞蛋：四種雞蛋去哪買、全聯動福蛋、有機蛋牧場、台中市店家、鴨蛋鵪鶉蛋等其他的蛋 |
| `organic.html` | 舊網址，自動轉到 `buy-eggs.html` |
| `washed-eggs.html` | 舊網址（洗選蛋頁已移除，對小朋友太難），自動轉到 `farming.html#letters` |

文字寫給國小低年級的小朋友看；地址、電話、統計表等詳細資料收在每頁的「給爸爸媽媽看」區塊。

給小朋友看的文字全部加了注音（課本式直排），「給爸爸媽媽看」區塊和店家資料不加。

## 怎麼修改頁面

`index.html`、`chickens.html`、`farming.html`、`buy-eggs.html` 是**產生出來的檔案，不要直接改**：

1. 改 `src/` 裡對應的 `*.src.html`。
2. 執行 `node tools/build-zhuyin.js`（加 `--dump` 會另外輸出 `tools/zhuyin-review.txt`，列出每個字的注音方便檢查）。

注音從 `tools/zhuyin-dict.txt` 查，長的詞優先，所以破音字、輕聲和「一」「不」的變調都寫成詞；字典裡沒有的字，程式會停下來列出來。也可以直接寫 `⟪雞的祕密|ㄐㄧ ˙ㄉㄜ ㄇㄧˋ ㄇㄧˋ⟫` 指定注音。JS 字串裡要顯示的文字寫成 `"⟪播放⟫"`，並用 `innerHTML` 放進頁面。

共用樣式（含注音排版）在 `assets/style.css`，小測驗在 `assets/quiz.js`，插圖（自己畫的 SVG）在 `assets/img/`。改了共用檔案要把各頁的 `?v=` 版本號加一。

資料來源：農業部統計處、中央社（2026/9/13）、各店家官網。

## 照片授權

`assets/photos/` 裡的照片來自 Wikimedia Commons，已縮小尺寸，依原授權使用（CC BY-SA 照片的縮小版同樣以 CC BY-SA 4.0 釋出）：

| 檔案 | 原圖 | 作者 | 授權 |
|---|---|---|---|
| `duck-eggs.jpg` | [Duck Eggs Green Background.png](https://commons.wikimedia.org/wiki/File:Duck_Eggs_Green_Background.png) | Whitlox | CC0 |
| `quail-eggs.jpg` | [Quail eggs, Rostov-on-Don, Russia.jpg](https://commons.wikimedia.org/wiki/File:Quail_eggs,_Rostov-on-Don,_Russia.jpg) | Vyacheslav Argenberg | CC BY 4.0 |
| `salted-egg.jpg` | [Salted duck egg yolk.jpg](https://commons.wikimedia.org/wiki/File:Salted_duck_egg_yolk.jpg) | Fumikas Sagisavas | CC0 |
| `pidan.jpg` | [Century egg.jpg](https://commons.wikimedia.org/wiki/File:Century_egg.jpg) | Laughlin Elkind | CC BY 2.0 |
| `tea-egg.jpg` | [Tea eggs 1.jpg](https://commons.wikimedia.org/wiki/File:Tea_eggs_1.jpg) | Daniela Eftimova | CC BY-SA 4.0 |
| `iron-egg.jpg` | [Iron Eggs clone … IMG 0263.jpg](https://commons.wikimedia.org/wiki/File:Iron_Eggs_clone_compared_to_a_5_minutes_coocked_and_peeled_chicken_egg_IMG_0263.jpg) | Hans Haase | CC BY-SA 4.0 |

`assets/img/` 裡的插圖是本站自己畫的 SVG。
