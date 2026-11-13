# 門要關了！
- 規格以 docs/PLAN.md 為準，改動玩法前先問我
- 技術：Vite + TypeScript + Phaser 4（Matter），純靜態，無後端
- 設計尺寸 720x1280 直向，Scale.FIT
- 數值一律寫在 src/data/*.json，不要寫死在程式裡；介面文字集中在 src/data/strings.json
- 資源路徑用 import.meta.env.BASE_URL
- assets/ 內的 irasutoya 圖不在 MIT 授權內；
  新增圖片必須更新 public/assets/CREDITS.md，總數不超過 20 張
- 不要把 raw-assets/ 加入 git
- 每次改完跑 npm run build 確認可以建置
