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
- Raiseは「追加でいくら」ではなく `Raise to` 方式
- Bet / Raise額は自由入力ではなく `+ / -` ボタンで調整
- `Min` / `1/2 Pot` / `Pot` / `All-in` の金額プリセット
- Big Blind基準のミニマムBet / ミニマムRaise
- ホールカード、コミュニティカード、ポット、チップ、コミット額の表示
- カード型UIとスート記号（♠ ♥ ♦ ♣）表示
- Community Cards公開時の軽い表示演出
- CPUカードは通常裏向き、ショーダウン時は表向き
- CPUはアクション前に短いthinking delayを挟みます。待ち時間は定数で調整できます。
- 7枚から最強5枚を選ぶ役判定
- キッカー込みの役比較
- 複数All-in時のMain Pot / Side Pot計算
- Potごとの獲得資格者判定
- 同点時のPotごとの分割
- ゲームログ表示
- 人間プレイヤー敗退時のゲームオーバーとリスタート

## ベット / レイズ仕様

Betは現在のベットラウンドで誰もBetしていない場合に行えます。最小BetはBig Blind相当です。残チップが最小Bet未満の場合は、最小Bet未満でもAll-in Betとして実行できます。

Raiseは `Raise to` 方式です。たとえばCurrent Betが80で `Raise to 160` を選んだ場合、そのプレイヤーのラウンド内コミット額が160になるように追加チップを支払います。

ミニマムRaiseは、現在の最大Bet額に最後の正式なBet/Raise幅を足した額です。プリフロップではBig Blindを最後の正式Raise幅として扱うため、Small Blind 10 / Big Blind 20 の場合、最小Raise toは40です。

Bet / Raise額は自由入力欄ではなく、`--` / `-` / `+` / `++` と `Min` / `1/2 Pot` / `Pot` / `All-in` ボタンで調整します。通常の増減はBig Blind単位、大きめの増減はBig Blindの5倍です。`1/2 Pot` と `Pot` はNo Limit用の便利ボタンで、厳密なPot Limit計算ではありません。

All-inはミニマムBet / Raise未満でも可能です。All-inが現在Bet以下ならAll-in Call、現在Betを上回るがミニマムRaise未満ならUnder Raise All-in、ミニマムRaise以上ならFull Raise All-inとして扱います。Full Raise All-inだけが最後の正式Raise幅を更新し、他プレイヤーのアクションを再オープンします。Under Raise All-inでは現在の最大Bet額は上がりますが、最後の正式Raise幅は更新しません。

## 現時点で簡略化している仕様

- サイドポットは実装済みです。複数All-in時はMain Pot / Side Potを分け、Potごとにeligible playerのみで勝者判定します。
- 同点時はPotごとに均等分割します。端数チップは現在のシート順で前の勝者から1チップずつ配ります。
- ベット再オープンは、正式なFull Raiseのみ他Activeプレイヤーへ再アクションを回す簡略実装です。Under Raise All-in済みプレイヤーには再度アクションを回しません。
- CPUはルールベースです。プリフロップのざっくりした手札評価、ポストフロップの成立役とドローをもとに行動します。
- localStorage保存は未対応です。リロードすると最初からになります。

## 今後の拡張候補

- CPUの勝率計算
- Monte Carloシミュレーション
- localStorage保存
- 戦績表示
- モバイル対応
- UI改善
