# WIE

> This project is based on [wie](https://github.com/dlunch/wie), created by Inseok Lee.
> 이 저장소는 원본 WIE에 터치 입력(`wie-web/src/ts/touch.ts`)을 추가하고 광고·분석·Sentry를 뺀 개인용 수정본입니다.

[Homepage](https://wie-site.dlunch.net) | [Try in browser](https://wie.dlunch.net)

A standalone emulator for old mobile apps based on WIPI, SKVM or J2ME.

This project is dedicated to digital preservation and educational research. Our goal is to revive the legacy of classic mobile games and allow them to be experienced in modern environments.

- [Contribution guide](https://github.com/dlunch/wie/blob/main/CONTRIBUTING.md)
- Architecture docs: [Emulator](docs/architecture.md) | [KTF](docs/ktf.md) | [LGT](docs/lgt.md)

## Frontend

The web and Android/iOS frontends are maintained in this repository under `wie-web` and `wie-app`.

```bash
npm install
npm run build:dev   # development web build
npm run build:prod  # production web build
npm start           # web development server
```

## Related projects

- [RustJava](https://github.com/dlunch/RustJava)
- [smaf](https://github.com/dlunch/smaf)
