# 이미지 넣는 법

| 파일 | 내용 | 칸 배치 템플릿 |
|---|---|---|
| `assets/sprites.png` | 기사·NPC·몬스터 초상화 (5열 × 4행) | `sprite_template.png` |
| `assets/items.png` | 등급별 검·철퇴·갑옷, 회복물약, 금화 (5열 × 4행) | `item_template.png` |
| `assets/icons.png` | UI 아이콘 36개 (6열 × 6행) | `icon_template.png` |
| `assets/sprites/ogre.png` | 오우거 단독 이미지 (있으면 시트 대신 사용) | — |
| `assets/ui/*.png` | 그림 UI 테마 (bg, panel, card, button, button_primary, banner, frame) | — |

- 시트 이미지는 균등 격자 한 장으로 만들어 위 이름으로 저장하면 게임이 칸 단위로 잘라서 씁니다.
- 잘린 결과는 `tools/spriteTemplate.html`을 Live Server로 열어 확인하세요. 주소 뒤에 `?sheet=items` 또는 `?sheet=icons`를 붙이면 해당 시트를 봅니다.
- 그림 UI 테마는 `assets/ui`의 7개 파일이 모두 있을 때 자동으로 켜지고, 설정 화면에서 끌 수 있습니다.
- 칸 배치나 설명은 `src/config/gameConfig.js`의 `sprites`, `itemSprites`, `icons`, `uiTheme`에서 바꿀 수 있습니다.
