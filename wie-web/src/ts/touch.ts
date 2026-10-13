// 터치 입력 레이어: 게임 화면의 탭/스와이프를 피처폰 키 입력으로 바꾼다.
// 게임별 설정은 PROFILES에 앱 ID(KTF는 PID)로 등록한다. 등록되지 않은 게임은 기본 동작(탭=OK, 스와이프=방향키)만 쓴다.
// 한 게임 안에서도 화면(게임 중, 상점 등)마다 터치 영역이 달라서, 지금 화면을 픽셀 색으로 알아낸 뒤 그 화면의 영역을 쓴다.

type Rgb = [number, number, number];
type Direction = "up" | "down" | "left" | "right";

interface TouchZone {
  key: string;
  // 게임 화면 픽셀 좌표 (캔버스 내부 해상도 기준)
  x: number;
  y: number;
  w: number;
  h: number;
}

// 화면 판별용 픽셀 조건: (x, y)가 rgb 색이어야 함. not이면 그 색이 아니어야 함.
interface PixelCheck {
  x: number;
  y: number;
  rgb: Rgb;
  not?: true;
}

interface TouchScreen {
  name: string;
  match: PixelCheck[]; // 비어 있으면 항상 해당
  zones: TouchZone[];
  tapKey?: string; // 영역 밖을 탭했을 때 보낼 키
  swipe: Partial<Record<Direction, string>>;
}

type SetKey = (source: string, key?: string) => void;

const ARROWS: Partial<Record<Direction, string>> = { up: "UP", down: "DOWN", left: "LEFT", right: "RIGHT" };
const DEFAULT_SCREEN: TouchScreen = { name: "기본", match: [], zones: [], tapKey: "OK", swipe: ARROWS };

const grid3x3 = (x: number, y: number, cellW: number, cellH: number): TouchZone[] =>
  Array.from({ length: 9 }, (_, i) => ({
    key: String(i + 1),
    x: x + (i % 3) * cellW,
    y: y + Math.floor(i / 3) * cellH,
    w: cellW,
    h: cellH,
  }));

const SHOP_BLUE: Rgb = [37, 146, 255];
// 아래 정보판의 MILK 막대 위·아래 테두리. 막대 안쪽은 우유가 차면 색이 바뀌어서 테두리를 본다.
const MILK_BAR_BORDER: PixelCheck[] = [
  { x: 120, y: 168, rgb: [0, 144, 0] },
  { x: 120, y: 176, rgb: [0, 144, 0] },
];

const PROFILES: Record<string, TouchScreen[]> = {
  // 짜요짜요타이쿤 (KTF, 176x220)
  PD000779: [
    {
      // 상인이 찾아왔을 때 뜨는 우유 거래 화면 (물건 사는 상점과는 다른 화면)
      name: "상인 거래",
      match: [
        { x: 8, y: 130, rgb: SHOP_BLUE },
        { x: 64, y: 130, rgb: SHOP_BLUE },
        ...MILK_BAR_BORDER,
      ],
      zones: [
        { key: "1", x: 0, y: 118, w: 88, h: 25 }, // 1.거래
        { key: "2", x: 88, y: 118, w: 88, h: 25 }, // 2.거절
        { key: "UP", x: 60, y: 86, w: 64, h: 10 }, // 단가 올리기
        { key: "DOWN", x: 60, y: 96, w: 64, h: 10 }, // 단가 내리기
      ],
      swipe: { up: "UP", down: "DOWN" },
    },
    {
      name: "목장",
      match: [
        ...MILK_BAR_BORDER,
        { x: 130, y: 182, rgb: [73, 183, 255] },
        // 풀밭 색은 계절마다 바뀌어서, "상점 화면이 아님"으로 판별한다
        { x: 8, y: 130, rgb: SHOP_BLUE, not: true },
      ],
      zones: [
        // 소 자리 3x3 = 키패드 1~9
        ...grid3x3(44, 55, 44, 39),
        { key: "0", x: 0, y: 133, w: 44, h: 34 }, // 우유통: 우유 담기
      ],
      // 영역 밖 탭은 OK (게임 중 뜨는 메시지 닫기)
      tapKey: "OK",
      // 위: 상점, 아래: 정보, 좌우: 늑대 쫓기(총)
      swipe: { up: "UP", down: "DOWN", left: "*", right: "*" },
    },
    {
      name: "메뉴",
      // 메뉴 항목 사이의 검은 테두리 (시작 메뉴 7개, 새 게임 메뉴 3개 모두 같은 자리)
      match: [74, 85, 96, 107].map((y) => ({ x: 66, y, rgb: [0, 0, 0] as Rgb })),
      zones: Array.from({ length: 7 }, (_, i) => ({ key: String(i + 1), x: 63, y: 74 + i * 11, w: 60, h: 11 })),
      tapKey: "OK",
      swipe: ARROWS,
    },
    DEFAULT_SCREEN,
  ],
};

const SWIPE_MIN_PX = 28; // 이보다 많이 움직이면 탭이 아니라 스와이프
const TAP_HOLD_MS = 90; // 탭/스와이프 한 번에 키를 누르고 있는 시간
const COLOR_TOLERANCE = 12;

const pressBriefly = (setKey: SetKey, source: string, key: string) => {
  setKey(source, key);
  setTimeout(() => setKey(source), TAP_HOLD_MS);
};

const toGamePoint = (canvas: HTMLCanvasElement, clientX: number, clientY: number) => {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * canvas.width,
    y: ((clientY - rect.top) / rect.height) * canvas.height,
  };
};

const pixelMatches = (ctx: CanvasRenderingContext2D, check: PixelCheck) => {
  const [r, g, b, a] = ctx.getImageData(check.x, check.y, 1, 1).data;
  // 투명 픽셀은 색 조건에 맞지 않는 것으로 본다 (검은색 0,0,0과 구분)
  if (a < 255) return false;
  const [er, eg, eb] = check.rgb;
  const same = Math.abs(r - er) <= COLOR_TOLERANCE && Math.abs(g - eg) <= COLOR_TOLERANCE && Math.abs(b - eb) <= COLOR_TOLERANCE;
  return check.not ? !same : same;
};

const currentScreen = (canvas: HTMLCanvasElement, screens: TouchScreen[]) => {
  const ctx = canvas.getContext("2d")!;
  return screens.find((s) => s.match.every((c) => pixelMatches(ctx, c))) ?? DEFAULT_SCREEN;
};

const hitZone = (screen: TouchScreen, x: number, y: number) =>
  screen.zones.find((z) => x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h);

const ripple = (wrapper: HTMLElement, clientX: number, clientY: number) => {
  const rect = wrapper.getBoundingClientRect();
  const dot = document.createElement("span");
  dot.className = "touch-ripple";
  dot.style.left = `${clientX - rect.left}px`;
  dot.style.top = `${clientY - rect.top}px`;
  wrapper.append(dot);
  dot.addEventListener("animationend", () => dot.remove());
};

// 터치 영역 확인용: 주소 끝에 #touchdebug 를 붙이면 지금 화면의 영역을 그린다.
const drawDebugZones = (wrapper: HTMLElement, canvas: HTMLCanvasElement, screen: TouchScreen) => {
  wrapper.querySelectorAll(".touch-zone-debug").forEach((el) => el.remove());
  for (const z of screen.zones) {
    const el = document.createElement("span");
    el.className = "touch-zone-debug";
    el.style.left = `${(z.x / canvas.width) * 100}%`;
    el.style.top = `${(z.y / canvas.height) * 100}%`;
    el.style.width = `${(z.w / canvas.width) * 100}%`;
    el.style.height = `${(z.h / canvas.height) * 100}%`;
    el.textContent = z.key;
    wrapper.append(el);
  }
};

export const attachTouch = (appId: string, setKey: SetKey, signal: AbortSignal) => {
  const canvas = document.getElementById("canvas") as HTMLCanvasElement | null;
  const wrapper = canvas?.parentElement;
  if (!canvas || !wrapper) return;
  const screens = PROFILES[appId] ?? [DEFAULT_SCREEN];

  // 게임이 화면 크기를 정하면(예: 176x220) 화면 비율을 그에 맞춘다. 기본값 3:4로 두면 그림이 늘어난다.
  const syncAspect = () => {
    wrapper.style.aspectRatio = `${canvas.width} / ${canvas.height}`;
    wrapper.style.setProperty("--screen-ratio", String(canvas.width / canvas.height));
  };
  const observer = new MutationObserver(syncAspect);
  observer.observe(canvas, { attributes: true, attributeFilter: ["width", "height"] });
  syncAspect();

  const debugTimer = location.hash.includes("touchdebug")
    ? setInterval(() => drawDebugZones(wrapper, canvas, currentScreen(canvas, screens)), 500)
    : undefined;

  signal.addEventListener("abort", () => {
    observer.disconnect();
    clearInterval(debugTimer);
    wrapper.style.aspectRatio = "";
    wrapper.style.removeProperty("--screen-ratio");
    wrapper.querySelectorAll(".touch-zone-debug").forEach((el) => el.remove());
  });

  const starts = new Map<number, { x: number; y: number; screen: TouchScreen; zone?: TouchZone }>();

  canvas.addEventListener(
    "pointerdown",
    (event) => {
      event.preventDefault();
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // 이미 떨어진 포인터 등 캡처할 수 없는 경우에도 입력은 처리한다
      }
      ripple(wrapper, event.clientX, event.clientY);
      const screen = currentScreen(canvas, screens);
      const p = toGamePoint(canvas, event.clientX, event.clientY);
      // 키는 손가락을 뗄 때 보낸다. 영역 위에서 시작한 스와이프가 영역 키로 먹히지 않게 하기 위해서다.
      starts.set(event.pointerId, { x: event.clientX, y: event.clientY, screen, zone: hitZone(screen, p.x, p.y) });
    },
    { signal },
  );

  const end = (event: PointerEvent, cancelled: boolean) => {
    const start = starts.get(event.pointerId);
    if (!start) return;
    starts.delete(event.pointerId);
    if (cancelled) return;
    const source = `touch:${event.pointerId}`;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.hypot(dx, dy) >= SWIPE_MIN_PX) {
      const dir: Direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
      const key = start.screen.swipe[dir];
      if (key) pressBriefly(setKey, source, key);
    } else {
      const key = start.zone?.key ?? start.screen.tapKey;
      if (key) pressBriefly(setKey, source, key);
    }
  };
  canvas.addEventListener("pointerup", (e) => end(e, false), { signal });
  canvas.addEventListener("pointercancel", (e) => end(e, true), { signal });
};
