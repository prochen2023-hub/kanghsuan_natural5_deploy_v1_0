# 自然探究實驗室 v2.1.0｜全面 QA 報告

## 本版修復主因

1. v2.0 第二單元「科學破案」把多個不同概念誤共用相同 SVG 模板，造成弦樂、管樂、打擊、頻率、音色、人聲、音箱等卡片看起來像同一張圖；光學直進、折射、海市蜃樓亦有類似情況。
2. 朗讀雖存在於課程頂端與部分題目，但生活情境、小實驗、遊戲與救援等區塊覆蓋不足。
3. 「樂器如何發出聲音」網站模擬每次建立新的 AudioContext，部分行動瀏覽器會處於 suspended 狀態，因此可能按「撥一下」沒有聲音。

## v2.1 修復

- 第二單元 24 張科學破案卡，現在有 24 個獨立 visual type 與 24 份不同 SVG 圖解。
- 實際執行 SVG renderer 後做 SHA-1 比對：24/24 markup hash 皆不同，避免只改名稱卻仍共圖。
- U2-1：樂音／噪音、聲級計、振幅、防噪三層、聽力暴露各有獨立圖。
- U2-2：三類樂器、頻率、弦長／張力、空氣柱、打擊片、三要素、人聲、音箱各有獨立圖。
- U2-3：直進、折射、海市蜃樓、凸透鏡、成像、聚光安全、近視、彩虹、泡泡、光聲速度、水族箱各有獨立圖。
- 朗讀擴充到：單元介紹、首頁／單元每課入口、生活情境、每張破案卡、每個 mini lab、實驗說明、證據結論、記憶法、課內題、救援題、連連看左右欄、分類題、科學島題、段考題、考後解析。
- 聲音模擬改為 persistent AudioContext；按鈕點擊時若 context suspended 會先 resume。
- 「撥一下」使用含泛音的短促撥弦音 envelope，最大 gain 由極低值提升到可聽的 0.28。
- 新增「🔔 測試喇叭」440 Hz，方便確認網站音訊與裝置靜音問題。
- 播放後有 aria-live 狀態文字，顯示實際播放的概念頻率。

## 自動檢查

`node qa_v21.js` 全數 PASS：

- 12 課存在。
- 前 6 課每課 >=30 題。
- 前 6 課每課 >=3 個生活情境與 >=3 個 mini lab。
- U2 三課 detail sections = 5 / 8 / 11。
- 300 個分課題 ID 唯一。
- 期中 A/B、期末 A/B 均為 100 分、40 分鐘，題目 ID 唯一。
- HTML 靜態 ID 無重複。
- app.js / data.js / index.html / styles.css 無 TODO/FIXME/TBD/PLACEHOLDER。
- U1/U2 所有 visual type 均有 handler。
- U2 24 個 visual type 全部是獨立 handler。
- U2 renderer 實際輸出 24/24 SVG hash 均不同。
- 所有主要學習／遊戲／評量區塊都有朗讀 handler。
- AudioContext resume、測試音、撥弦音與播放狀態皆存在。
- 全站所有 click 型 `data-*` action 靜態對照事件處理器：0 個未處理入口。

## HTTP smoke test

以本機靜態伺服器檢查：

- 200 index.html
- 200 styles.css
- 200 data.js
- 200 app.js
- 200 manifest.webmanifest
- 200 sw.js
- 200 404.html
- 200 VERSION
- 200 assets/icon.svg

## 瀏覽器限制說明

此執行環境的受管理 Chromium 會直接封鎖 localhost 與容器內網網址並顯示「Your organization doesn’t allow you to view this site」，因此無法在這裡完成真正的 Chromium 點擊／實際喇叭輸出測試。這不是網站回傳錯誤：同一靜態伺服器以 curl 檢查上述資源皆 HTTP 200。

聲音修復已針對行動瀏覽器常見的 AudioContext suspended 問題處理；部署到 GitHub Pages 後仍建議用實際手機按一次「🔔 測試喇叭」與「🎸 撥一下」確認裝置未靜音。
