# companion-module-marshall-visca

Controls Marshall CV PTZ cameras (CV605, CV607, CV612, CV620, CV630, CV730) over VISCA over IP with [Bitfocus Companion](https://bitfocus.io/companion).

Requires Companion 5.1 or later (`@companion-module/base` 2.2). See [HELP.md](./companion/HELP.md) for usage and [ROADMAP.md](./ROADMAP.md) for planned features.

## Development

```bash
corepack enable
yarn install
yarn test     # unit tests and tests against a fake VISCA over IP camera
yarn package  # builds the module package
```
