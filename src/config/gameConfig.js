// ─────────────────────────────────────────────────────────────
//  게임 전체 수치·모양 데이터
//  여기 값만 바꾸면 게임에 그대로 반영됩니다.
//  좌표 단위는 모두 "칸 길이" (칸 하나 = 1 x 1), y축은 아래쪽이 +
// ─────────────────────────────────────────────────────────────

// 곡선 글자용: 중심 (cx, cy), 반지름 r, from→to 각도(도)의 호를 꺾은선 점 목록으로
//  각도 0 = 오른쪽, 90 = 아래, -90(또는 270) = 위 (y축이 아래로 + 이기 때문)
function arc(cx, cy, r, from, to) {
  const steps = Math.max(4, Math.round(Math.abs(to - from) / 20));
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = (from + (to - from) * i / steps) * Math.PI / 180;
    pts.push([+(cx + Math.cos(a) * r).toFixed(4), +(cy + Math.sin(a) * r).toFixed(4)]);
  }
  return pts;
}

export const CONFIG = {
  version: '2026-10-21h (휠로 블록 회전)', // 메인 메뉴 아래에 표시 — 브라우저가 예전 파일을 쓰는지 확인용

  // 전투 판 크기 (칸). 최대 체력 = 판 칸 수 (플레이어 6×6 = 36칸)
  board: {
    playerW: 6, playerH: 6,
    enemyW: 6, enemyH: 6, // 내 판과 같은 크기 (몸 칸 수는 적마다 다름)
  },

  // 블록 체력 — 코어 없음. 칸이 하나도 안 남으면 패배. 연결이 끊겨도 무너지지 않음
  body: {
    startFill: 0.7,            // 시작할 때 판을 채우는 비율 (0.7 = 36칸 중 25칸)
    baseEnhance: 3,            // 기본 강화 횟수. 실제 = 기본 + 체력×enhancePerVit + 방어구
    tierHp: [1, 2, 3],         // 강화 단계별 칸 체력 [기본, 1차(하트), 2차(방패)]
    restoreHpAfterBattle: true // 전투 후 금 간(체력이 깎인) 칸의 체력 회복 여부. 부서진 칸은 복구 안 됨
  },

  // 스탯
  stats: {
    keys: ['str', 'agi', 'tec', 'vit', 'int'],
    names: { str: '힘', agi: '민첩', tec: '기술', vit: '체력', int: '지능' },
    icons: { str: '💪', agi: '🏃', tec: '🎯', vit: '❤️', int: '🧠' },
    desc: {
      str: '무기 장착 요구치 · 칸당 피해 (10 이상: 2)',
      agi: '회피 기술 해금 (5: 슬라이딩, 10: 도약)',
      tec: '공격 기술 해금 (5 / 7 / 10 구간)',
      vit: '1당 강화 횟수 +1 (최대 체력은 판 크기 36칸 고정)',
      int: '장착 공격 기술 수 (4: 2개, 9: 3개)',
    },
    rollMin: 1, rollMax: 5,    // 시작 주사위 범위
    rollWeights: [40, 30, 15, 10, 5], // 주사위 눈별 확률(%) — rollMin 부터 순서대로 (1: 40%, 2: 30%, 3: 15%, 4: 10%, 5: 5%)
    cap: 20,                   // 스탯 상한
    damageByStr: [[0, 1], [10, 2]],            // [최소 힘, 칸당 피해]
    enhancePerVit: 1,
    attackSlotsByInt: [[0, 1], [4, 2], [9, 3]], // [최소 지능, 장착 가능 공격 기술 수]

    // 매 포인트마다 붙는 작은 효과 (구간 효과와 별개로 계속 쌓임)
    perPoint: {
      strLineWidth: 0.02,      // 힘 1당 내 공격 선 두께 +칸 (철퇴 고리는 안쪽으로 두꺼워짐)
      agiEnemyWidth: -0.01,    // 민첩 1당 내가 맞는 적 공격 선 두께 (음수 = 얇아짐)
      agiEnemyWidthMin: 0.1,   // 적 공격 선 두께 최소값
      tecReach: 0.05,          // 기술 1당 기술 선 길이·원 반경 +칸
      intLearnDiscount: 0.02,  // 지능 1당 훈련교관 학습 비용 -비율
      intLearnDiscountMax: 0.6, // 학습 비용 할인 최대치
    },
  },

  // 공격 판정 공통
  attack: {
    playerLineWidth: 0.3,  // 플레이어 기술 선 두께 (칸 길이)
    enemyLineWidth: 0.3,   // 적 글자 공격 선 두께
    letterSize: 3,         // 적 글자 크기 (letter:true 모양의 좌표 배율)
  },

  // ── 공격 모양 (벡터 도형) ──────────────────────────────
  //  prims: 도형 목록
  //    { type:'line', points:[[x,y], ...] }  두께 있는 직선/꺾은선 (끝은 둥근 캡)
  //    { type:'circle', center:[x,y], r }     원 (center 생략 시 [0,0])
  //    { type:'ring', center:[x,y], r, inner } 가운데가 빈 고리 (inner 안쪽은 피해 없음)
  //  원점 [0,0] = 조준점(마우스/AI 위치), 회전도 원점 기준
  //  letter:true 이면 좌표에 attack.letterSize 를 곱함 (-0.5~0.5 범위로 그리면 됨)
  //  width 를 넣으면 그 모양만 두께를 따로 지정
  shapes: {
    // 플레이어 기술
    punch:  { label: '주먹', prims: [{ type: 'circle', r: 0.4 }] },  // 기존 0.6 의 2/3
    slashV: { label: '세로베기', prims: [{ type: 'line', points: [[0, -2], [0, 2]] }] },
    slashH: { label: '가로베기', prims: [{ type: 'line', points: [[-2, 0], [2, 0]] }] },
    slashD: { label: '사선베기', prims: [{ type: 'line', points: [[-1.6, 1.6], [1.6, -1.6]] }] },
    slashX: { label: '십자베기', prims: [
      { type: 'line', points: [[0, -2], [0, 2]] },
      { type: 'line', points: [[-2, 0], [2, 0]] },
    ] },
    // 철퇴: 'ring' = 가운데가 빈 고리(o). r 바깥 반지름, inner 안쪽 구멍 반지름 (구멍 안 칸은 피해 없음)
    smash:  { label: '내려찍기', prims: [{ type: 'ring', r: 1.5, inner: 0.8 }] },  // 지름 3
    twin:   { label: '쌍격', prims: [
      { type: 'ring', center: [-1.1, 0], r: 0.9, inner: 0.45 },
      { type: 'ring', center: [1.1, 0], r: 0.9, inner: 0.45 },
    ] },
    quake:  { label: '대지 강타', prims: [{ type: 'ring', r: 2.5, inner: 1.6 }] }, // 지름 5

    // 적 글자 공격 (letter:true → ×letterSize)
    I:    { label: '1', letter: true, prims: [{ type: 'line', points: [[0, -0.5], [0, 0.5]] }] },
    DASH: { label: 'ㅡ', letter: true, prims: [{ type: 'line', points: [[-0.5, 0], [0.5, 0]] }] },
    DIAG: { label: '/', letter: true, prims: [{ type: 'line', points: [[-0.35, 0.35], [0.35, -0.35]] }] }, // 대각 직선 (길이 약 3)
    ORB:  { label: '●', letter: true, prims: [{ type: 'circle', r: 0.2 }] },                              // 작은 원 (반지름 0.6칸)
    L: { label: 'L', letter: true, prims: [{ type: 'line', points: [[-0.4, -0.5], [-0.4, 0.5], [0.4, 0.5]] }] },
    T: { label: 'T', letter: true, prims: [
      { type: 'line', points: [[-0.5, -0.5], [0.5, -0.5]] },
      { type: 'line', points: [[0, -0.5], [0, 0.5]] },
    ] },
    V: { label: 'V', letter: true, prims: [{ type: 'line', points: [[-0.5, -0.5], [0, 0.5], [0.5, -0.5]] }] },
    X: { label: 'X', letter: true, prims: [
      { type: 'line', points: [[-0.5, -0.5], [0.5, 0.5]] },
      { type: 'line', points: [[0.5, -0.5], [-0.5, 0.5]] },
    ] },
    H: { label: 'H', letter: true, prims: [
      { type: 'line', points: [[-0.45, -0.5], [-0.45, 0.5]] },
      { type: 'line', points: [[0.45, -0.5], [0.45, 0.5]] },
      { type: 'line', points: [[-0.45, 0], [0.45, 0]] },
    ] },
    U: { label: 'U', letter: true, prims: [
      { type: 'line', points: [[-0.45, -0.5], [-0.45, 0.5], [0.45, 0.5], [0.45, -0.5]] },
    ] },
    K: { label: 'K', letter: true, prims: [
      { type: 'line', points: [[-0.4, -0.5], [-0.4, 0.5]] },
      { type: 'line', points: [[0.45, -0.5], [-0.4, 0.05]] },
      { type: 'line', points: [[-0.15, -0.12], [0.45, 0.5]] },
    ] },
    M: { label: 'M', letter: true, prims: [
      { type: 'line', points: [[-0.5, 0.5], [-0.5, -0.5], [0, 0.15], [0.5, -0.5], [0.5, 0.5]] },
    ] },
    W: { label: 'W', letter: true, prims: [
      { type: 'line', points: [[-0.5, -0.5], [-0.25, 0.5], [0, -0.15], [0.25, 0.5], [0.5, -0.5]] },
    ] },
    E: { label: 'E', letter: true, prims: [
      { type: 'line', points: [[0.45, -0.5], [-0.45, -0.5], [-0.45, 0.5], [0.45, 0.5]] },
      { type: 'line', points: [[-0.45, 0], [0.3, 0]] },
    ] },

    // 보스 이름 글자 (곡선은 arc() 로 만든 꺾은선). 키는 대소문자 구분: 'm' ≠ 'M'
    //  슬라임 엠페러: S l i m e  /  드래곤: D r a g o n
    S: { label: 'S', letter: true, prims: [
      { type: 'line', points: [...arc(0, -0.25, 0.25, -20, -270), ...arc(0, 0.25, 0.25, -90, 160)] },
    ] },
    l: { label: 'l', letter: true, prims: [{ type: 'line', points: [[-0.05, -0.5], [-0.05, 0.38], [0.15, 0.5]] }] },
    i: { label: 'i', letter: true, prims: [
      { type: 'line', points: [[0, -0.1], [0, 0.5]] },
      { type: 'circle', center: [0, -0.38], r: 0.08 },
    ] },
    m: { label: 'm', letter: true, prims: [
      { type: 'line', points: [[-0.45, -0.15], [-0.45, 0.5]] },
      { type: 'line', points: [[-0.45, 0.05], ...arc(-0.225, 0.05, 0.225, 180, 360), [0, 0.5]] },
      { type: 'line', points: [[0, 0.05], ...arc(0.225, 0.05, 0.225, 180, 360), [0.45, 0.5]] },
    ] },
    e: { label: 'e', letter: true, prims: [
      { type: 'line', points: [[-0.4, 0.1], [0.4, 0.1], ...arc(0, 0.1, 0.4, 0, -310)] },
    ] },
    D: { label: 'D', letter: true, prims: [
      { type: 'line', points: [[-0.4, 0.5], [-0.4, -0.5], [0, -0.5], ...arc(0, 0, 0.5, -90, 90), [-0.4, 0.5]] },
    ] },
    r: { label: 'r', letter: true, prims: [
      { type: 'line', points: [[-0.25, -0.2], [-0.25, 0.5]] },
      { type: 'line', points: [[-0.25, 0.1], ...arc(0.05, 0.1, 0.3, 180, 320)] },
    ] },
    a: { label: 'a', letter: true, prims: [
      { type: 'line', points: arc(-0.05, 0.2, 0.3, 0, 360) },
      { type: 'line', points: [[0.25, -0.2], [0.25, 0.5]] },
    ] },
    g: { label: 'g', letter: true, prims: [
      { type: 'line', points: arc(0, -0.1, 0.25, 0, 360) },
      { type: 'line', points: [[0.25, -0.35], [0.25, 0.25], ...arc(0, 0.25, 0.25, 0, 160)] },
    ] },
    o: { label: 'o', letter: true, prims: [{ type: 'line', points: arc(0, 0.1, 0.4, 0, 360) }] },
    n: { label: 'n', letter: true, prims: [
      { type: 'line', points: [[-0.35, -0.2], [-0.35, 0.5]] },
      { type: 'line', points: [[-0.35, 0.1], ...arc(0, 0.1, 0.35, 180, 360), [0.35, 0.5]] },
    ] },
  },

  // 무기
  weapons: {
    families: {
      fist:  { name: '맨손', icon: '✊' },   // 무기가 없거나 힘이 모자랄 때
      sword: { name: '검',   icon: '🗡️' },
      mace:  { name: '철퇴', icon: '🔨' },
    },
    circleExtendFactor: 1,   // 등급 확장값 × 이 값 = 원 반지름 증가량
    starting: null,          // 시작 무기. 예: { family: 'sword', grade: 0 }  (null = 맨손으로 시작)
  },

  // 공격 기술 (family 계열, tecReq 기술 스탯 요구치, shape 위 shapes 키)
  attackSkills: {
    punch:  { family: 'fist',  name: '주먹치기', tecReq: 0,  shape: 'punch' },
    slashV: { family: 'sword', name: '세로베기', tecReq: 0,  shape: 'slashV' },
    slashH: { family: 'sword', name: '가로베기', tecReq: 5,  shape: 'slashH' },
    slashD: { family: 'sword', name: '사선베기', tecReq: 7,  shape: 'slashD' },
    slashX: { family: 'sword', name: '십자베기', tecReq: 10, shape: 'slashX' },
    smash:  { family: 'mace',  name: '내려찍기', tecReq: 0,  shape: 'smash' },
    twin:   { family: 'mace',  name: '쌍격',     tecReq: 7,  shape: 'twin' },
    quake:  { family: 'mace',  name: '대지 강타', tecReq: 10, shape: 'quake' },
  },

  // 회피 기술 ('#' = 칸)
  dodgeSkills: {
    roll:  { name: '구르기',   agiReq: 0,  grid: ['#', '#', '#'] },
    slide: { name: '슬라이딩', agiReq: 5,  grid: ['#..', '#..', '###'] },
    leap:  { name: '도약',     agiReq: 10, grid: ['###', '###', '###'] },
  },
  dodge: {
    starting: 'roll',
    maxShift: null,    // 틀을 옮길 수 있는 최대 거리 (가로·세로 각각 칸 수). null = 제한 없음 (판 안이면 어디든)
  },

  skills: {
    maxLearnedPerFamily: 3,  // 계열당 배울 수 있는 공격 기술 수
    maxLearnedDodge: 3,
  },

  // 아이템 등급 (strReq = 그 등급 무기를 장착하는 데 필요한 힘 — 검·철퇴 공통)
  grades: [
    { name: '일반', color: '#b0b7c3', strReq: 1, weaponExtend: 0, armorEnhance: 1, price: 50 },
    { name: '고급', color: '#5fd068', strReq: 3, weaponExtend: 0, armorEnhance: 2, price: 80 },
    { name: '희귀', color: '#4aa3ff', strReq: 5, weaponExtend: 1, armorEnhance: 3, price: 130 },
    { name: '영웅', color: '#b46cff', strReq: 7, weaponExtend: 1, armorEnhance: 4, price: 200 },
    { name: '전설', color: '#ffa726', strReq: 9, weaponExtend: 2, armorEnhance: 5, price: 300 },
  ],
  items: {
    // 등급 확률 [일반, 고급, 희귀, 영웅, 전설] (%)
    odds: {
      normal: [40, 30, 15, 10, 5],
      elite:  [10, 30, 35, 18, 7],
      boss:   [0, 0, 60, 30, 10],
      shop:   [40, 30, 15, 10, 5],
    },
    kindWeights: { weapon: 50, armor: 50 },
    weaponDrops: ['sword', 'mace'],
    armorName: '갑옷',
  },

  // 적
  enemies: {
    damage: 1,       // 적 공격 칸당 피해 (타입별 damage 로 덮어쓰기 가능)
    aimMargin: 1,    // AI 가 후보 위치를 뽑는 범위 = 대상 몸 외곽 + 이 값
    patternTiers: {
      simple: ['I', 'DASH', 'DIAG', 'ORB'], // 직선·작은 원만 (1스테이지 일반)
      low:  ['I', 'DASH'],
      mid:  ['L', 'T', 'V', 'X'],
      high: ['H', 'U', 'K'],
      top:  ['M', 'W', 'E'],
    },
    // cells: 몸 칸 수 범위 (판 5×5 = 최대 25), candidates: AI 후보 수 N, enhance: 몸에 들어갈 강화 수 (칸당 최대 2)
    // attacks: 한 턴에 하는 공격 목록.
    //   patterns = 사용 글자 등급 (patternTiers), 또는 shapes = 사용할 모양 키 목록 직접 지정
    //   scale = 크기 배율(기본 1)
    // names: { name: 표시 이름, sprite: sprites.cells 의 키 }
    types: {
      s1_monster: { cells: [10, 14], candidates: 3, enhance: 2,
        attacks: [{ patterns: ['simple'] }],
        names: [{ name: '고블린', sprite: 'goblin' }, { name: '슬라임', sprite: 'slime' }, { name: '늑대', sprite: 'wolf' }] },
      s1_elite:   { cells: [16, 20], candidates: 3, enhance: 6,
        attacks: [{ patterns: ['high'] }],
        names: [{ name: '슬라임 킹', sprite: 'slimeking' }, { name: '고블린 기사', sprite: 'goblinknight' }] },
      s1_boss:    { cells: [25, 25], candidates: 5, enhance: 14,
        attacks: [{ shapes: ['S', 'l', 'i', 'm', 'e'] }, { shapes: ['S', 'l', 'i', 'm', 'e'], scale: 0.7 }],
        names: [{ name: '슬라임 엠페러', sprite: 'slimeemperor' }] },
      s2_monster: { cells: [14, 18], candidates: 5, enhance: 6,
        attacks: [{ patterns: ['mid', 'high'] }],
        names: [{ name: '리자드맨', sprite: 'lizardman' }, { name: '오크', sprite: 'orc' }] },
      s2_elite:   { cells: [20, 24], candidates: 5, enhance: 12,
        attacks: [{ patterns: ['top'] }],
        names: [{ name: '와이번', sprite: 'wyvern' }, { name: '오우거', sprite: 'ogre' }] },
      s2_boss:    { cells: [25, 25], candidates: 7, enhance: 24,
        attacks: [{ shapes: ['D', 'r', 'a', 'g', 'o', 'n'] }, { shapes: ['D', 'r', 'a', 'g', 'o', 'n'], scale: 0.7 }],
        names: [{ name: '드래곤', sprite: 'dragon' }] },
    },
  },

  // 맵
  map: {
    stages: 2,
    floors: 10,
    firstFloorNodes: 3,
    minNodes: 2, maxNodes: 4,
    fixedFloors: { 1: 'monster', 9: 'inn', 10: 'boss' }, // 층 번호(1부터): 고정 노드
    // 층마다 성격을 하나 정하고, 그 층 노드는 그 성격 안에서만 나옴
    //  비전투 성격(service, rest)은 바로 다음 층에 같은 성격이 오지 않음 → 같은 비전투 칸 연속 없음
    floorKinds: {
      combat:  { weight: 55, types: { monster: 1 } },          // 전투 (eliteChance 만큼 정예로 바뀜)
      service: { weight: 25, types: { shop: 1, trainer: 1 } }, // 상점 또는 훈련교관
      rest:    { weight: 20, types: { inn: 1 } },              // 여관
    },
    eliteMinFloor: 4,
    eliteChance: 0.25,   // 전투 층 노드가 정예일 확률 (eliteMinFloor 층부터)
    nodeInfo: {
      monster: { name: '일반 몬스터', icon: '⚔️', color: '#7a8396' },
      elite:   { name: '정예 몬스터', icon: '💀', color: '#d9534f' },
      boss:    { name: '보스',       icon: '👑', color: '#f0ad4e' },
      shop:    { name: '상점',       icon: '🛒', color: '#5bc0de' },
      inn:     { name: '여관',       icon: '🛏️', color: '#5cb85c' },
      trainer: { name: '훈련교관',   icon: '📖', color: '#a77bff' },
    },
  },

  // 보상
  // 아이템 3택1 카드는 한 장씩 따로 뽑음: 회복물약 : 장비 = potionWeight : gearWeight
  rewards: {
    monster: { gold: [15, 25], stat: 1, odds: 'normal', potionWeight: 2, gearWeight: 1 },
    elite:   { gold: [35, 50], stat: 2, odds: 'elite', potionWeight: 0, gearWeight: 1 },  // 장비만
    boss:    { gold: [80, 80], stat: 2, odds: 'boss', potionWeight: 0, gearWeight: 1 },   // 장비만
    statChoices: 3,
    itemChoices: 3,
    potionSizes: [1, 2, 3],   // 전투 보상 회복약 칸 수
  },

  economy: { startGold: 20 },

  shop: {
    potions: [ { cells: 3, price: 40 }, { cells: 4, price: 55 }, { cells: 5, price: 70 } ],
    itemCount: 3,
    odds: 'shop',
  },

  inn: {
    healRounds: 2,       // 회복: 조각 3택1 을 몇 번
    healChoices: 3,
    healSizes: [3, 4, 5],
    trainAmount: 1,      // 훈련: 스탯 +
  },

  trainer: {
    learnsPerVisit: 2,
    learnCost: 40,   // 기술 1개 학습 비용(골드). 지능이 높을수록 할인 (stats.perPoint.intLearnDiscount)
  },

  // 몸 조각 (회복 블록 / 몸 생성에 사용)
  pieces: {
    shapes: {
      dot: ['#'],
      I2: ['##'],
      I3: ['###'], L3: ['#.', '##'],
      I4: ['####'], O4: ['##', '##'], T4: ['###', '.#.'], S4: ['.##', '##.'], Z4: ['##.', '.##'],
      L4: ['#.', '#.', '##'], J4: ['.#', '.#', '##'],
      U5: ['#.#', '###'], P5: ['##', '##', '#.'], L5: ['#.', '#.', '#.', '##'], T5: ['###', '.#.', '.#.'],
      W5: ['#..', '##.', '.##'], X5: ['.#.', '###', '.#.'],
    },
    genSizes: [3, 4, 4, 4, 5],  // 몸 자동 생성 때 고를 조각 크기
    palette: ['#e8554e', '#f2a541', '#e9cf3c', '#5cc96b', '#3fb8c9', '#4f7cff', '#9b6bff', '#ff6fb5'],
  },

  colors: { core: '#ffd54a' },

  sound: { volume: 0.5 },

  // ── 캐릭터 이미지 (스프라이트 시트) ──────────────────
  //  sheet 이미지를 cols × rows 균등 격자로 잘라 씁니다. 해상도는 상관없음 (격자만 균등하면 됨)
  //  at: [열, 행] (0부터). 이미지가 없으면 emoji 로 대신 표시
  //  격자 템플릿: tools/spriteTemplate.html 을 Live Server 로 열면 확인·다운로드 가능
  sprites: {
    sheet: 'assets/sprites.png',
    cols: 5, rows: 4,
    inset: 0.04,   // 칸 가장자리를 이 비율만큼 잘라 씀 (격자선 숨기기)
    style: '같은 화풍의 정통 판타지 캐릭터 반신 초상화, 정면을 향함, 어두운 단색 배경, 칸마다 캐릭터 하나',
    cells: {
      player_fist:  { at: [0, 0], emoji: '🛡️', desc: '기사 (맨손) — 판금 갑옷을 입은 젊은 기사, 건틀릿 주먹을 쥐고 있음' },
      player_sword: { at: [1, 0], emoji: '🗡️', desc: '기사 (검) — 같은 기사가 한손검을 들고 있음' },
      player_mace:  { at: [2, 0], emoji: '🔨', desc: '기사 (철퇴) — 같은 기사가 큰 철퇴를 들고 있음' },
      shopkeeper:   { at: [3, 0], emoji: '🛒', desc: '상점 주인 — 물약 병이 가득한 배낭을 멘 수상한 상인' },
      innkeeper:    { at: [4, 0], emoji: '🛏️', desc: '여관 주인 — 앞치마를 두른 푸근한 중년, 따뜻한 미소' },
      trainer:      { at: [0, 1], emoji: '📖', desc: '훈련교관 — 흉터 있는 노련한 검술 교관, 팔짱' },
      dummy:        { at: [1, 1], emoji: '🎯', desc: '훈련용 허수아비 — 짚과 나무로 만든 과녁 허수아비 (튜토리얼)' },
      goblin:       { at: [2, 1], emoji: '👺', desc: '고블린 — 녹색 피부의 작은 고블린, 녹슨 단검 (1스테이지 일반)' },
      slime:        { at: [3, 1], emoji: '🟩', desc: '슬라임 — 말랑한 초록 젤리 슬라임 (1스테이지 일반)' },
      wolf:         { at: [4, 1], emoji: '🐺', desc: '늑대 — 이빨을 드러낸 회색 늑대 (1스테이지 일반)' },
      slimeking:    { at: [0, 2], emoji: '🫅', desc: '슬라임 킹 — 작은 왕관을 쓴 커다란 슬라임 (1스테이지 정예)' },
      goblinknight: { at: [1, 2], emoji: '⚔️', desc: '고블린 기사 — 갑옷과 창을 든 고블린 기사 (1스테이지 정예)' },
      slimeemperor: { at: [2, 2], emoji: '👑', desc: '슬라임 엠페러 — 망토와 화려한 왕관의 거대 슬라임 황제 (1스테이지 보스)' },
      lizardman:    { at: [3, 2], emoji: '🦎', desc: '리자드맨 — 비늘 갑옷과 곡도를 든 도마뱀 전사 (2스테이지 일반)' },
      orc:          { at: [4, 2], emoji: '👹', desc: '오크 — 큰 도끼를 든 근육질 오크 (2스테이지 일반)' },
      wyvern:       { at: [0, 3], emoji: '🦅', desc: '와이번 — 날개를 펼친 독꼬리 와이번 (2스테이지 정예)' },
      // img: 이 파일이 있으면 시트 대신 이 그림을 씀 (없으면 시트 칸 사용)
      ogre:         { at: [1, 3], emoji: '🗿', img: 'assets/sprites/ogre.png', desc: '오우거 — 쇠사슬과 해골 장식을 두른 거대하고 흉포한 오우거, 가시 박힌 거대 몽둥이 (2스테이지 정예)' },
      dragon:       { at: [2, 3], emoji: '🐉', desc: '드래곤 — 불을 내뿜는 붉은 드래곤 (2스테이지 보스)' },
    },
  },

  // ── 아이템 이미지 (등급별 무기·방어구, 회복물약, 금화) ──
  //  키 규칙: sword_등급, mace_등급, armor_등급 (등급 0=일반 … 4=전설)
  itemSprites: {
    sheet: 'assets/items.png',
    cols: 5, rows: 4,
    inset: 0.04,
    cutout: true,
    cutoutTolerance: 36,
    style: '같은 화풍의 판타지 게임 아이템 아이콘, 정면에서 살짝 비스듬히 본 단일 물건, 부드러운 테두리 빛, 어두운 단색 배경, 칸마다 물건 하나. 등급이 오를수록 더 화려하고 빛남 (일반 → 고급 → 희귀 → 영웅 → 전설)',
    cells: {
      sword_0: { at: [0, 0], emoji: '🗡️', desc: '일반 검 — 투박한 무쇠 한손검, 가죽 손잡이' },
      sword_1: { at: [1, 0], emoji: '🗡️', desc: '고급 검 — 잘 다듬은 강철 검, 녹색 보석 하나' },
      sword_2: { at: [2, 0], emoji: '🗡️', desc: '희귀 검 — 푸른 룬이 빛나는 은빛 검' },
      sword_3: { at: [3, 0], emoji: '🗡️', desc: '영웅 검 — 보라색 마력이 흐르는 장식 검' },
      sword_4: { at: [4, 0], emoji: '🗡️', desc: '전설 검 — 황금빛 불꽃에 휩싸인 성검' },
      mace_0:  { at: [0, 1], emoji: '🔨', desc: '일반 철퇴 — 나무 자루에 무쇠 머리, 투박함' },
      mace_1:  { at: [1, 1], emoji: '🔨', desc: '고급 철퇴 — 강철 가시 철퇴, 녹색 장식' },
      mace_2:  { at: [2, 1], emoji: '🔨', desc: '희귀 철퇴 — 푸른 룬이 새겨진 은빛 철퇴' },
      mace_3:  { at: [3, 1], emoji: '🔨', desc: '영웅 철퇴 — 보라색 수정이 박힌 장식 철퇴' },
      mace_4:  { at: [4, 1], emoji: '🔨', desc: '전설 철퇴 — 황금빛 불꽃에 휩싸인 거대한 철퇴' },
      armor_0: { at: [0, 2], emoji: '🛡️', desc: '일반 갑옷 — 낡은 가죽 흉갑' },
      armor_1: { at: [1, 2], emoji: '🛡️', desc: '고급 갑옷 — 강철 판금 흉갑, 녹색 천 장식' },
      armor_2: { at: [2, 2], emoji: '🛡️', desc: '희귀 갑옷 — 푸른 룬이 빛나는 은빛 판금 갑옷' },
      armor_3: { at: [3, 2], emoji: '🛡️', desc: '영웅 갑옷 — 보라색 마력이 흐르는 장식 판금 갑옷' },
      armor_4: { at: [4, 2], emoji: '🛡️', desc: '전설 갑옷 — 황금빛으로 빛나는 성기사 갑옷' },
      potion_s:  { at: [0, 3], emoji: '🧪', desc: '작은 회복물약 — 작고 둥근 붉은 물약 병 (1~2칸)' },
      potion_m:  { at: [1, 3], emoji: '🧪', desc: '회복물약 — 중간 크기 붉은 물약 병 (3칸)' },
      potion_l:  { at: [2, 3], emoji: '🧪', desc: '큰 회복물약 — 큰 붉은 물약 플라스크 (4칸)' },
      potion_xl: { at: [3, 3], emoji: '🧪', desc: '최고급 회복물약 — 금장식의 화려한 빛나는 물약 (5칸 이상)' },
      gold:      { at: [4, 3], emoji: '💰', desc: '금화 주머니 — 금화가 쏟아지는 가죽 주머니' },
    },
  },

  // ── UI 아이콘 (이모지 대신 쓰는 작은 그림) ──
  //  bare: 이미지가 없을 때 배경 없이 이모지만 표시
  icons: {
    sheet: 'assets/icons.png',
    cols: 6, rows: 6,
    style: '같은 화풍의 판타지 RPG UI 아이콘, 작게 봐도 잘 보이는 굵은 실루엣, 어두운 단색 배경, 칸마다 아이콘 하나',
    inset: 0.04,
    bare: true,
    cutout: true,          // 누끼: 칸 배경을 투명하게 (가장자리에서 이어진 배경색만 지움)
    cutoutTolerance: 36,   // 배경으로 볼 색 차이 허용치 — 그림이 깎이면 낮추고, 배경이 남으면 높이기
    cells: {
      stat_str:     { at: [0, 0], emoji: '💪', desc: '힘 — 근육질 팔 / 주먹' },
      stat_agi:     { at: [1, 0], emoji: '🏃', desc: '민첩 — 날개 달린 장화' },
      stat_tec:     { at: [2, 0], emoji: '🎯', desc: '기술 — 화살이 꽂힌 과녁' },
      stat_vit:     { at: [3, 0], emoji: '❤️', desc: '체력 — 붉은 하트' },
      stat_int:     { at: [4, 0], emoji: '🧠', desc: '지능 — 빛나는 마법서' },
      dice:         { at: [5, 0], emoji: '🎲', desc: '주사위 — 상아색 육면체 주사위' },
      node_monster: { at: [0, 1], emoji: '⚔️', desc: '일반 몬스터 — 교차한 두 검' },
      node_elite:   { at: [1, 1], emoji: '💀', desc: '정예 몬스터 — 뿔 달린 해골' },
      node_boss:    { at: [2, 1], emoji: '👑', desc: '보스 — 붉은 보석 왕관' },
      node_shop:    { at: [3, 1], emoji: '🛒', desc: '상점 — 상인의 저울 / 가판대' },
      node_inn:     { at: [4, 1], emoji: '🛏️', desc: '여관 — 모닥불 또는 침대' },
      node_trainer: { at: [5, 1], emoji: '📖', desc: '훈련교관 — 펼쳐진 기술서와 검' },
      fam_fist:     { at: [0, 2], emoji: '✊', desc: '맨손 — 강철 건틀릿 주먹' },
      fam_sword:    { at: [1, 2], emoji: '🗡️', desc: '검 — 한손 장검' },
      fam_mace:     { at: [2, 2], emoji: '🔨', desc: '철퇴 — 플랜지 철퇴' },
      gold:         { at: [3, 2], emoji: '💰', desc: '금화 — 금화 더미' },
      cells:        { at: [4, 2], emoji: '🧱', desc: '몸(칸 수) — 갑옷 흉갑 / 방패' },
      enhance:      { at: [5, 2], emoji: '✨', desc: '강화 — 빛나는 마법 반짝임' },
      core:         { at: [0, 3], emoji: '⭐', desc: '핵심 코어 — 금빛으로 빛나는 별 보석' },
      subcore:      { at: [1, 3], emoji: '💠', desc: '보조 코어 — 푸른빛 별 보석' },
      pending:      { at: [2, 3], emoji: '📦', desc: '보관함 — 나무 보급 상자' },
      heal:         { at: [3, 3], emoji: '🩹', desc: '회복 — 붉은 회복 물약 + 빛' },
      train:        { at: [4, 3], emoji: '🏋️', desc: '훈련 — 나무 훈련용 검과 방패' },
      map:          { at: [5, 3], emoji: '🗺️', desc: '지도 — 말린 양피지 지도' },
      settings:     { at: [0, 4], emoji: '⚙️', desc: '설정 — 청동 톱니바퀴' },
      tutorial:     { at: [1, 4], emoji: '🎓', desc: '튜토리얼 — 깃펜과 두루마리' },
      sound_on:     { at: [2, 4], emoji: '🔊', desc: '소리 켜짐 — 황동 나팔 / 종' },
      sound_off:    { at: [3, 4], emoji: '🔇', desc: '소리 꺼짐 — 천으로 감싼 종' },
      victory:      { at: [4, 4], emoji: '🏆', desc: '승리 — 황금 트로피 / 월계관' },
      defeat:       { at: [5, 4], emoji: '💥', desc: '패배 — 부서진 방패' },
      lock:         { at: [0, 5], emoji: '🔒', desc: '잠금 — 쇠 자물쇠' },
      attack:       { at: [1, 5], emoji: '🗡️', desc: '공격 — 검기 / 베는 궤적' },
      dodge:        { at: [2, 5], emoji: '💨', desc: '회피 — 바람 / 질주 자국' },
      warning:      { at: [3, 5], emoji: '⚠️', desc: '예고 경고 — 붉은 느낌표 문장' },
      start:        { at: [4, 5], emoji: '🛡️', desc: '게임 시작 — 검이 꽂힌 방패 문장' },
      logo:         { at: [5, 5], emoji: '🏰', desc: '게임 로고 문장 — 성과 검이 그려진 문장(엠블럼)' },
    },
  },

  // ── 그림 UI 테마 (양피지 패널·나무 버튼 등). 파일이 모두 있으면 자동 적용, 설정에서 끌 수 있음 ──
  //  slice: CSS border-image-slice (9-slice 테두리 두께, 그림 크기 대비 %)
  uiTheme: {
    files: {
      bg:      'assets/ui/bg.png',
      panel:   'assets/ui/panel.png',
      card:    'assets/ui/card.png',
      button:  'assets/ui/button.png',
      primary: 'assets/ui/button_primary.png',
      banner:  'assets/ui/banner.png',
      frame:   'assets/ui/frame.png',
    },
  },
};
