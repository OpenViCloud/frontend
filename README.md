# OpenViCloud frontend

The web front of OpenViCloud:

- `site/`: the public website (landing page with live prices, customer docs) in English and Vietnamese, built with Astro.
- `portal/`: the customer portal and the admin portal, built with React and Vite, one source tree and two images.

The API they call is [OpenViCloud/titan](https://github.com/OpenViCloud/titan), and the design docs live there too.
Paths such as `docs/features/...` in code comments refer to that repository.

## Develop

Node 22.

```sh
(cd portal && npm install && npm run dev)    # customer portal at /, admin portal at /admin.html
(cd site && npm install && npm run dev)
```

`npm run dev` in `portal/` needs a running OpenViCloud dev cluster: it sends `/v1` to `http://api.localhost:8080` and
takes `/config.json` from `http://portal.localhost:8080` (admin: `http://admin.localhost:8080`). The cluster is set up
by `local-cluster/mac` in [OpenViCloud/titan](https://github.com/OpenViCloud/titan). The admin portal's router is
mounted at `/`: open `/admin.html`, then navigate inside the app (see `portal/README.md`).

## Test

```sh
(cd portal && npm run lint && npm test && npm run build)
(cd site && npm test && npm run build)
```

`site/` checks that the bold labels of its docs are labels the portal shows. It reads `portal/src/i18n/`,
`portal/src/lib/*State.ts` and the API contract `api/openapi-v1.json`.

## API contract

`api/openapi-v1.json` is a copy of the contract published by titan. `api/SOURCE` names the titan commit it was copied
from. To update it, run:

```sh
scripts/sync-spec.sh <titan commit, tag or branch>
```

## License

[MPL-2.0](LICENSE)
