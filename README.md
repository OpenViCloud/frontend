# OpenViCloud frontend

The web front of OpenViCloud:

- `site/`: the public website (landing page with live prices, customer docs) in English and Vietnamese, built with Astro.
- `portal/`: the customer portal and the admin portal, built with React and Vite, one source tree and two images.

The API they call is [OpenViCloud/titan](https://github.com/OpenViCloud/titan), and the design docs live there too.
Paths such as `docs/features/...` in code comments refer to that repository.

## Develop

Node 22.

```sh
cd portal && npm install && npm run dev    # customer portal at /, admin portal at /admin.html
cd site && npm install && npm run dev
```

`npm run dev` in `portal/` talks to a running OpenViCloud API at `http://api.localhost:8080` (see `portal/README.md`).

## Test

```sh
cd portal && npm run lint && npm test && npm run build
cd site && npm test && npm run build
```

`site/` checks that the bold labels of its docs are labels the portal shows. It reads `portal/src/i18n/` and the
API contract `api/openapi-v1.json`.

## API contract

`api/openapi-v1.json` is a copy of the contract published by titan. `api/SOURCE` names the titan commit it was copied
from. To update it, run:

```sh
scripts/sync-spec.sh <titan commit, tag or branch>
```

## License

[MPL-2.0](LICENSE)
