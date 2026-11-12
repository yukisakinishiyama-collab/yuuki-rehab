/**
 * 見た目は小さいまま、指で押せる範囲だけを上下左右に 12px 広げる（下のタブが出る幅＝1024px未満だけ）。
 *
 * 院内アプリの決まり（DESIGN_DECISIONS.md「押す場所の大きさ」）では、指で押すものは 40px 以上。
 * ふつうは max-lg:min-h-10 で大きくするが、16〜20px の小さなチェックや「i」のボタンのように、
 * 大きくすると並びがくずれる部品にだけ、これを使う（16px の部品で 40px、20px の部品で 44px 押せる）。
 * となりの押す所と上下左右とも 12px 以上はなれているときだけ使う（重なると、となりを押したつもりでこちらが押される。
 * 足りなければ max-lg:mr-1 などで間をあける。チップを並べた「×」のように、上下の列と近いものには使わない）。
 *
 *   className={cn('w-4 h-4 rounded border-2', TAP_AREA)}
 */
export const TAP_AREA = 'max-lg:relative max-lg:after:absolute max-lg:after:-inset-3'
