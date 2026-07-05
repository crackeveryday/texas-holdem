# Texas Hold'em

React + TypeScript + Vite で作成した、ブラウザ完結型の1人用テキサスホールデムMVPです。

人間プレイヤー1人とCPU4人の合計5人テーブルで、プリフロップ、フロップ、ターン、リバー、ショーダウンまで進行できます。

demo: https://crackeveryday.github.io/texas-holdem/

## 技術スタック

- React
- TypeScript
- Vite
- Vitest

## 起動方法

```bash
npm install
npm run dev
```

## ビルド方法

```bash
npm run build
```

## テスト実行方法

```bash
npm test
```

## GitHub Pages 公開時の注意点

`vite.config.ts` の `base` は、このリポジトリ名に合わせて `/texas-holdem/` に設定しています。

別名のリポジトリで公開する場合は、`base` を `/<repository-name>/` に変更してください。独自ドメインやユーザーサイト直下で公開する場合は `/` に変更します。

## 実装済みの主な仕様

- 人間1人 + CPU4人の5人テーブル
- Dealer Button / Small Blind / Big Blind
- Check / Call / Bet / Raise / Fold / All-in
- ホールカード、コミュニティカード、ポット、チップ、コミット額の表示
- CPUカードは通常裏向き、ショーダウン時は表向き
- 7枚から最強5枚を選ぶ役判定
- キッカー込みの役比較
- ゲームログ表示
- 人間プレイヤー敗退時のゲームオーバーとリスタート

## 現時点で簡略化している仕様

- サイドポットは厳密実装していません。複数人が異なる額でAll-inした場合も、MVPでは単一ポットとして扱います。
- CPUはルールベースです。プリフロップのざっくりした手札評価、ポストフロップの成立役とドローをもとに行動します。
- localStorage保存は未対応です。リロードすると最初からになります。

## 今後の拡張候補

- 厳密なサイドポット対応
- CPUの勝率計算
- Monte Carloシミュレーション
- localStorage保存
- 戦績表示
- モバイル対応
- UI改善
